/**
 * TableWise payments worker (Cloudflare Workers free tier).
 *
 * Routes
 *   POST /paypal/activate   (signed-in user)  verify a new PayPal subscription and unlock Pro
 *   POST /paypal/webhook    (PayPal)          renewals, cancellations
 *   POST /crypto/invoice    (signed-in user)  create a NOWPayments hosted invoice
 *   POST /crypto/webhook    (NOWPayments)     IPN – unlock Pro when a payment is finished
 *
 * The browser is never trusted: every payment is checked with PayPal / NOWPayments
 * before the user's plan is written to Firestore with a service account.
 */
import { firestore, Fields } from './firestore';
import { verifyFirebaseIdToken } from './auth';
import { sortKeysDeep, hmacSha512Hex, timingSafeEqual } from './crypto';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  APP_URL: string;
  APP_ORIGINS: string;
  PRICE_MONTH_USD: string;
  PRICE_YEAR_USD: string;
  PAYPAL_ENV: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_PLAN_ID: string;
  PAYPAL_WEBHOOK_ID: string;
  PAYPAL_SECRET: string;
  NOWPAYMENTS_API_KEY: string;
  NOWPAYMENTS_IPN_SECRET: string;
  GOOGLE_SERVICE_ACCOUNT: string;
}

const DAY = 86_400_000;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'tablewise-payments' }, 200, cors);
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    try {
      switch (url.pathname) {
        case '/paypal/activate':
          return json(await paypalActivate(req, env), 200, cors);
        case '/paypal/webhook':
          return json(await paypalWebhook(req, env), 200);
        case '/crypto/invoice':
          return json(await cryptoInvoice(req, env), 200, cors);
        case '/crypto/webhook':
          return json(await cryptoWebhook(req, env), 200);
        default:
          return json({ error: 'Not found' }, 404, cors);
      }
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e?.stack || e);
      return json({ error: status === 500 ? 'Server error' : e.message }, status, cors);
    }
  },
};

/* ------------------------------------------------------------------ */
/* PayPal                                                              */
/* ------------------------------------------------------------------ */

function paypalBase(env: Env) {
  return env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

let paypalToken: { value: string; exp: number } | null = null;

async function paypalAccessToken(env: Env): Promise<string> {
  if (paypalToken && paypalToken.exp > Date.now() + 60_000) return paypalToken.value;
  const res = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data: any = await res.json();
  paypalToken = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return paypalToken.value;
}

async function paypalGet(env: Env, path: string): Promise<any> {
  const res = await fetch(`${paypalBase(env)}${path}`, {
    headers: { Authorization: `Bearer ${await paypalAccessToken(env)}` },
  });
  if (res.status === 404) throw new HttpError(404, 'Subscription not found');
  if (!res.ok) throw new Error(`PayPal GET ${path} failed: ${res.status}`);
  return res.json();
}

/** Writes Pro access from a PayPal subscription object. Returns the uid. */
async function applySubscription(env: Env, sub: any): Promise<string | null> {
  const uid: string | undefined = sub?.custom_id;
  if (!uid || sub.plan_id !== env.PAYPAL_PLAN_ID) return null;
  const fs = firestore(env);
  const status: string = sub.status || 'UNKNOWN';
  const fields: Fields = { paypalSubscriptionId: sub.id, paypalStatus: status };

  if (status === 'ACTIVE') {
    // Access runs to the next billing date plus a one-day grace period.
    const next = Date.parse(sub.billing_info?.next_billing_time || '');
    const until = Number.isFinite(next) ? next + DAY : Date.now() + 31 * DAY;
    const user = await fs.get(`users/${uid}`);
    const current = user?.planExpiresAt instanceof Date ? user.planExpiresAt.getTime() : 0;
    Object.assign(fields, { plan: 'pro', planSource: 'paypal', planExpiresAt: new Date(Math.max(until, current)) });
  }
  // Cancelled/suspended: keep planExpiresAt – they keep what they already paid for.
  await fs.update(`users/${uid}`, fields);
  return uid;
}

async function paypalActivate(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const body: any = await req.json().catch(() => ({}));
  const id = String(body.subscriptionId || '');
  if (!/^I-[A-Z0-9]+$/.test(id)) throw new HttpError(400, 'Invalid subscription id');

  const sub = await paypalGet(env, `/v1/billing/subscriptions/${id}`);
  if (sub.custom_id !== uid) throw new HttpError(403, 'This subscription belongs to another account');
  if (sub.plan_id !== env.PAYPAL_PLAN_ID) throw new HttpError(400, 'Unknown plan');
  if (sub.status !== 'ACTIVE') throw new HttpError(409, `Subscription is ${sub.status}. It may take a minute to activate.`);
  await applySubscription(env, sub);
  return { ok: true };
}

async function paypalWebhook(req: Request, env: Env) {
  const raw = await req.text();
  const event = JSON.parse(raw);

  const verify = await fetch(`${paypalBase(env)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await paypalAccessToken(env)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: req.headers.get('paypal-auth-algo'),
      cert_url: req.headers.get('paypal-cert-url'),
      transmission_id: req.headers.get('paypal-transmission-id'),
      transmission_sig: req.headers.get('paypal-transmission-sig'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });
  const result: any = await verify.json().catch(() => ({}));
  if (result.verification_status !== 'SUCCESS') throw new HttpError(400, 'Invalid webhook signature');

  const type: string = event.event_type;
  const r = event.resource || {};

  if (type.startsWith('BILLING.SUBSCRIPTION.')) {
    // ACTIVATED, RE-ACTIVATED, UPDATED, CANCELLED, SUSPENDED, EXPIRED, PAYMENT.FAILED
    const sub = r.id ? await paypalGet(env, `/v1/billing/subscriptions/${r.id}`) : r;
    await applySubscription(env, sub);
  } else if (type === 'PAYMENT.SALE.COMPLETED' && r.billing_agreement_id) {
    const sub = await paypalGet(env, `/v1/billing/subscriptions/${r.billing_agreement_id}`);
    const uid = await applySubscription(env, sub);
    if (uid) {
      const fs = firestore(env);
      const user = await fs.get(`users/${uid}`);
      await fs.create('payments', `pp_${r.id}`, {
        uid,
        email: (user?.email as string) || '',
        provider: 'paypal',
        amountUsd: Number(r.amount?.total || 0),
        currency: r.amount?.currency || 'USD',
        note: `Subscription ${sub.id}`,
        createdAt: new Date(),
      });
    }
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Crypto (NOWPayments)                                                */
/* ------------------------------------------------------------------ */

function priceFor(env: Env, months: number): number {
  return months === 12 ? Number(env.PRICE_YEAR_USD) : Number(env.PRICE_MONTH_USD);
}

async function cryptoInvoice(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const body: any = await req.json().catch(() => ({}));
  const months = Number(body.months) === 12 ? 12 : 1;
  const amount = priceFor(env, months);
  const origin = new URL(req.url).origin;

  const res = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: { 'x-api-key': env.NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: amount,
      price_currency: 'usd',
      order_id: `${uid}:${months}:${Date.now()}`,
      order_description: `TableWise Pro – ${months === 12 ? '12 months' : '1 month'}`,
      ipn_callback_url: `${origin}/crypto/webhook`,
      success_url: `${env.APP_URL}/pro?paid=1`,
      cancel_url: `${env.APP_URL}/pro`,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.invoice_url) {
    console.error('NOWPayments invoice error', res.status, JSON.stringify(data));
    throw new HttpError(502, 'Could not start crypto checkout. Please try again.');
  }
  return { url: data.invoice_url };
}

async function cryptoWebhook(req: Request, env: Env) {
  const raw = await req.text();
  const body = JSON.parse(raw);
  const sig = req.headers.get('x-nowpayments-sig') || '';
  const expected = await hmacSha512Hex(env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortKeysDeep(body)));
  if (!sig || !timingSafeEqual(sig.toLowerCase(), expected)) throw new HttpError(400, 'Invalid signature');

  if (body.payment_status !== 'finished') return { ok: true, ignored: body.payment_status };

  const [uid, monthsStr] = String(body.order_id || '').split(':');
  const months = Number(monthsStr) === 12 ? 12 : 1;
  if (!uid) throw new HttpError(400, 'Missing order id');

  // The invoice amount must match the plan price (in USD).
  const paidUsd = Number(body.price_amount);
  if (String(body.price_currency).toLowerCase() !== 'usd' || !(paidUsd >= priceFor(env, months) - 0.01)) {
    console.error('Crypto amount mismatch', JSON.stringify(body));
    return { ok: true, ignored: 'amount mismatch' };
  }

  const fs = firestore(env);
  const paymentId = `np_${body.payment_id}`;
  if (await fs.get(`payments/${paymentId}`)) return { ok: true, duplicate: true };

  const user = await fs.get(`users/${uid}`);
  if (!user) throw new HttpError(404, 'User not found');
  const current = user.planExpiresAt instanceof Date ? user.planExpiresAt.getTime() : 0;
  const days = months === 12 ? 365 : 30;
  const until = new Date(Math.max(Date.now(), current) + days * DAY);

  await fs.update(`users/${uid}`, { plan: 'pro', planSource: 'crypto', planExpiresAt: until });
  await fs.create('payments', paymentId, {
    uid,
    email: (user.email as string) || '',
    provider: 'crypto',
    amountUsd: paidUsd,
    currency: String(body.pay_currency || '').toUpperCase(),
    note: `${months === 12 ? '12 months' : '1 month'} · ${body.pay_amount ?? ''} ${String(body.pay_currency || '').toUpperCase()}`,
    createdAt: new Date(),
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function requireUser(req: Request, env: Env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new HttpError(401, 'Please log in first.');
  try {
    return await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw new HttpError(401, 'Your session expired. Please log in again.');
  }
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = env.APP_ORIGINS.split(',').map((s) => s.trim());
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

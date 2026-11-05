/**
 * TableWise payments worker (Cloudflare Workers free tier).
 *
 * Routes
 *   POST /paypal/order      (signed-in user)  create a PayPal order for a Day / Month / Year pass
 *   POST /paypal/capture    (signed-in user)  capture that order and unlock Pro
 *   POST /paypal/activate   (signed-in user)  verify a PayPal subscription (legacy monthly plan)
 *   POST /paypal/webhook    (PayPal)          captures, renewals, cancellations
 *   POST /trial/claim       (signed-in user)  free-trial limit: max TRIAL_PER_IP accounts per network
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
  PRICE_DAY_USD: string;
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
  /** Secret salt for hashing IP addresses (never stored in plain form). */
  IP_SALT: string;
  /** How many accounts on one network get the free trial (default 2). */
  TRIAL_PER_IP?: string;
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
        case '/paypal/order':
          return json(await paypalCreateOrder(req, env), 200, cors);
        case '/paypal/capture':
          return json(await paypalCapture(req, env), 200, cors);
        case '/paypal/activate':
          return json(await paypalActivate(req, env), 200, cors);
        case '/paypal/webhook':
          return json(await paypalWebhook(req, env), 200);
        case '/trial/claim':
          return json(await trialClaim(req, env), 200, cors);
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

  if (type === 'PAYMENT.CAPTURE.COMPLETED') {
    // One-time pass paid (also covers buyers who closed the page before capture returned).
    const customId = r.custom_id || '';
    if (customId) await grantFromCapture(env, r, customId);
  } else if (type.startsWith('BILLING.SUBSCRIPTION.')) {
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

type PlanId = 'day' | 'month' | 'year';
const PLAN_DAYS: Record<PlanId, number> = { day: 1, month: 30, year: 365 };
const PLAN_NAME: Record<PlanId, string> = { day: 'Day Pass (24 hours)', month: '1 month', year: '12 months' };

function planOf(v: unknown): PlanId {
  const s = String(v);
  if (s === 'day' || s === 'year') return s;
  if (s === '12') return 'year'; // older invoices used months
  return 'month';
}

function priceFor(env: Env, plan: PlanId): number {
  return Number(plan === 'day' ? env.PRICE_DAY_USD : plan === 'year' ? env.PRICE_YEAR_USD : env.PRICE_MONTH_USD);
}

/** Adds a pass to the user's access (stacking on any time left) and records the payment once. */
async function grantPass(env: Env, uid: string, plan: PlanId, paymentId: string, provider: string, amountUsd: number, note: string) {
  const fs = firestore(env);
  if (await fs.get(`payments/${paymentId}`)) return { ok: true, duplicate: true };
  const user = await fs.get(`users/${uid}`);
  if (!user) throw new HttpError(404, 'User not found');
  const current = user.planExpiresAt instanceof Date ? user.planExpiresAt.getTime() : 0;
  const until = new Date(Math.max(Date.now(), current) + PLAN_DAYS[plan] * DAY);
  await fs.update(`users/${uid}`, { plan: 'pro', planSource: provider === 'paypal' ? 'paypal' : 'crypto', planExpiresAt: until, planName: plan });
  await fs.create('payments', paymentId, {
    uid, email: (user.email as string) || '', provider, amountUsd, currency: 'USD', note, createdAt: new Date(),
  });
  return { ok: true };
}

/* ---------- PayPal one-time passes (Orders API) ---------- */

async function paypalPost(env: Env, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${paypalBase(env)}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await paypalAccessToken(env)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('PayPal POST', path, res.status, JSON.stringify(data));
    throw new HttpError(502, 'PayPal could not process this payment. You have not been charged.');
  }
  return data;
}

async function paypalCreateOrder(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const body: any = await req.json().catch(() => ({}));
  const plan = planOf(body.plan);
  const order = await paypalPost(env, '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: 'USD', value: priceFor(env, plan).toFixed(2) },
      custom_id: `${uid}:${plan}`,
      description: `TableWise Pro – ${PLAN_NAME[plan]}`,
    }],
  });
  return { id: order.id };
}

/** Grants a pass from a completed PayPal capture (used by /paypal/capture and the webhook). */
async function grantFromCapture(env: Env, capture: any, customId: string) {
  const [uid, planRaw] = String(customId || '').split(':');
  const plan = planOf(planRaw);
  const value = Number(capture?.amount?.value);
  if (!uid || capture?.status !== 'COMPLETED') return { ok: false };
  if (capture.amount?.currency_code !== 'USD' || !(value >= priceFor(env, plan) - 0.01)) {
    console.error('PayPal amount mismatch', JSON.stringify(capture));
    return { ok: false };
  }
  return grantPass(env, uid, plan, `ppo_${capture.id}`, 'paypal', value, PLAN_NAME[plan]);
}

async function paypalCapture(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const body: any = await req.json().catch(() => ({}));
  const id = String(body.orderId || '');
  if (!/^[A-Z0-9]{10,40}$/.test(id)) throw new HttpError(400, 'Invalid order id');
  const order = await paypalPost(env, `/v2/checkout/orders/${id}/capture`, {});
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!String(unit?.custom_id || '').startsWith(`${uid}:`)) throw new HttpError(403, 'This order belongs to another account');
  const r = await grantFromCapture(env, capture, unit.custom_id);
  if (!r.ok) throw new HttpError(409, 'Payment not completed.');
  return { ok: true };
}

async function cryptoInvoice(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const body: any = await req.json().catch(() => ({}));
  const plan = planOf(body.plan ?? (Number(body.months) === 12 ? 'year' : 'month'));
  const amount = priceFor(env, plan);
  const origin = new URL(req.url).origin;

  const res = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: { 'x-api-key': env.NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: amount,
      price_currency: 'usd',
      order_id: `${uid}:${plan}:${Date.now()}`,
      order_description: `TableWise Pro – ${PLAN_NAME[plan]}`,
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

  const [uid, planRaw] = String(body.order_id || '').split(':');
  const plan = planOf(planRaw);
  if (!uid) throw new HttpError(400, 'Missing order id');

  // The invoice amount must match the plan price (in USD).
  const paidUsd = Number(body.price_amount);
  if (String(body.price_currency).toLowerCase() !== 'usd' || !(paidUsd >= priceFor(env, plan) - 0.01)) {
    console.error('Crypto amount mismatch', JSON.stringify(body));
    return { ok: true, ignored: 'amount mismatch' };
  }
  await grantPass(env, uid, plan, `np_${body.payment_id}`, 'crypto', paidUsd,
    `${PLAN_NAME[plan]} · ${body.pay_amount ?? ''} ${String(body.pay_currency || '').toUpperCase()}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Free-trial limit per network                                        */
/* ------------------------------------------------------------------ */

/** One-way, salted hash of the caller's IP – the IP itself is never stored. */
export async function ipHash(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function trialClaim(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0].trim() || '';
  if (!ip) throw new HttpError(400, 'Could not read your network address.');
  const max = Math.max(1, Number(env.TRIAL_PER_IP || 2));
  const fs = firestore(env);
  const key = await ipHash(ip, env.IP_SALT);
  const doc = await fs.get(`trialIps/${key}`);
  const uids = String(doc?.uids || '').split(',').filter(Boolean);
  let ok: boolean;
  if (uids.includes(uid)) ok = true;
  else if (uids.length < max) {
    uids.push(uid);
    ok = true;
    if (doc) await fs.update(`trialIps/${key}`, { uids: uids.join(','), updatedAt: new Date() });
    else await fs.create('trialIps', key, { uids: uids.join(','), updatedAt: new Date() });
  } else ok = false;
  const user = await fs.get(`users/${uid}`);
  if (user && user.trialOk !== ok) await fs.update(`users/${uid}`, { trialOk: ok });
  return { ok, limit: max };
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

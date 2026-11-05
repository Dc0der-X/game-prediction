/**
 * TableWise payments worker (Cloudflare Workers free tier).
 *
 * Routes
 *   POST /checkout          (signed-in user)  create a hosted checkout (card or crypto) for a Day / Month / Year pass
 *   POST /pass/start        (signed-in user)  the buyer is back from checkout: switch the pass on right away
 *   POST /crypto/webhook    (NOWPayments)     IPN – confirms, extends or puts the pass on hold
 *   POST /trial/claim       (signed-in user)  free-trial limit: max TRIAL_PER_IP accounts per network
 *   POST /crypto/invoice    alias of /checkout (older app versions)
 *   POST /telegram/webhook  (Telegram)        24/7 support bot (src/bot.ts)
 *
 * Instant access, automatic hold:
 *   1. The buyer pays and lands back on /pro?paid=<ref>. The app calls /pass/start and the pass
 *      switches on at once (planSource "pending") for HOLD_MINUTES (default 60).
 *   2. Payment seen on the network (confirming / confirmed / sending) → the pending time is extended.
 *   3. Payment finished → the full pass is granted (Day / Month / Year), counted from the purchase.
 *   4. Payment failed / expired, or no confirmation within HOLD_MINUTES → access stops by itself
 *      ("on hold – payment not received"). If the payment arrives later, the pass switches back on.
 *   An account can have only one unconfirmed instant start at a time, so the instant hour can't be farmed.
 *
 * The browser is never trusted: only NOWPayments' signed IPN can grant a full pass, and plans are
 * written to Firestore with a service account.
 */
import { firestore, Fields } from './firestore';
import { verifyFirebaseIdToken } from './auth';
import { sortKeysDeep, hmacSha512Hex, timingSafeEqual } from './crypto';
import { BotEnv, telegramWebhook } from './bot';

export interface Env extends BotEnv {
  FIREBASE_PROJECT_ID: string;
  APP_URL: string;
  APP_ORIGINS: string;
  PRICE_DAY_USD: string;
  PRICE_MONTH_USD: string;
  PRICE_YEAR_USD: string;
  NOWPAYMENTS_API_KEY: string;
  NOWPAYMENTS_IPN_SECRET: string;
  GOOGLE_SERVICE_ACCOUNT: string;
  /** Secret salt for hashing IP addresses (never stored in plain form). */
  IP_SALT: string;
  /** How many accounts on one network get the free trial (default 2). */
  TRIAL_PER_IP?: string;
  /** Minutes of instant access while a payment confirms (default 60). */
  HOLD_MINUTES?: string;
}

const DAY = 86_400_000;
const MIN = 60_000;

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
        case '/checkout':
        case '/crypto/invoice':
          return json(await createCheckout(req, env), 200, cors);
        case '/pass/start':
          return json(await passStart(req, env), 200, cors);
        case '/crypto/webhook':
          return json(await cryptoWebhook(req, env), 200);
        case '/trial/claim':
          return json(await trialClaim(req, env), 200, cors);
        case '/telegram/webhook':
          // Always 200 so Telegram doesn't retry; the bot replies on its own.
          return json(await telegramWebhook(req, env).catch((e) => (console.error(e), { ok: false })), 200);
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
  // An instant (pending) start is replaced by the real pass, counted from when it started.
  const pending = user.planSource === 'pending' || user.planSource === 'hold';
  const from = pending
    ? (user.pendingSince instanceof Date ? user.pendingSince.getTime() : Date.now())
    : Math.max(Date.now(), current);
  const until = new Date(Math.max(Date.now(), from + PLAN_DAYS[plan] * DAY));
  await fs.update(`users/${uid}`, {
    plan: 'pro', planSource: 'crypto', planExpiresAt: until, planName: plan, pendingRef: '', pendingPlan: '',
  });
  await fs.create('payments', paymentId, {
    uid, email: (user.email as string) || '', provider, amountUsd, currency: 'USD', note, createdAt: new Date(),
  });
  return { ok: true };
}

/* ---------- Checkout ---------- */

function newRef(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const CHECKOUTS_PER_HOUR = 10;

async function createCheckout(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const fs0 = firestore(env);
  const me = await fs0.get(`users/${uid}`);
  if (!me) throw new HttpError(404, 'User not found');
  // Rate limit: a handful of checkouts per hour is plenty for a real buyer.
  const winStart = typeof me.coWindow === 'number' ? me.coWindow : 0;
  const inWindow = Date.now() - winStart < 3_600_000;
  const count = inWindow && typeof me.coCount === 'number' ? me.coCount : 0;
  if (count >= CHECKOUTS_PER_HOUR) throw new HttpError(429, 'Too many checkouts in a short time – please try again in a little while.');
  await fs0.update(`users/${uid}`, { coWindow: inWindow ? winStart : Date.now(), coCount: count + 1 });
  const body: any = await req.json().catch(() => ({}));
  const plan = planOf(body.plan ?? (Number(body.months) === 12 ? 'year' : 'month'));
  const amount = priceFor(env, plan);
  const origin = new URL(req.url).origin;
  const ref = newRef();

  const res = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: { 'x-api-key': env.NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: amount,
      price_currency: 'usd',
      order_id: `${uid}:${plan}:${ref}`,
      order_description: `TableWise Pro – ${PLAN_NAME[plan]}`,
      ipn_callback_url: `${origin}/crypto/webhook`,
      success_url: `${env.APP_URL}/pro?paid=${ref}`,
      cancel_url: `${env.APP_URL}/pro`,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.invoice_url) {
    console.error('NOWPayments invoice error', res.status, JSON.stringify(data));
    throw new HttpError(502, 'Could not open checkout. Please try again.');
  }
  await firestore(env).create('checkouts', ref, { uid, plan, amountUsd: amount, createdAt: new Date(), startedAt: null });
  return { url: data.invoice_url, ref };
}

function holdMs(env: Env) {
  return Math.max(5, Number(env.HOLD_MINUTES || 60)) * MIN;
}

/** Back from checkout: switch the pass on now; the IPN confirms it (or the hold kicks in by itself). */
async function passStart(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const body: any = await req.json().catch(() => ({}));
  const ref = String(body.ref || '');
  if (!/^[a-f0-9]{24}$/.test(ref)) throw new HttpError(400, 'Invalid checkout reference');
  const fs = firestore(env);
  const co = await fs.get(`checkouts/${ref}`);
  if (!co || co.uid !== uid) throw new HttpError(404, 'Checkout not found');
  const created = co.createdAt instanceof Date ? co.createdAt.getTime() : 0;
  if (Date.now() - created > 6 * 3_600_000) return { ok: false, status: 'expired' };

  const user = await fs.get(`users/${uid}`);
  if (!user) throw new HttpError(404, 'User not found');
  const until = user.planExpiresAt instanceof Date ? user.planExpiresAt.getTime() : 0;
  if (await fs.get(`payments/ref_${ref}`)) return { ok: true, status: 'paid' };
  // Already on a paid pass: nothing to switch on – the payment stacks when it confirms.
  if (user.plan === 'pro' && user.planSource === 'crypto' && until > Date.now()) return { ok: true, status: 'active' };
  // One unconfirmed instant start per account: an earlier unpaid checkout blocks a second free hour.
  if (user.pendingRef && user.pendingRef !== ref) return { ok: false, status: 'waiting' };
  if (co.startedAt instanceof Date) return { ok: true, status: until > Date.now() ? 'pending' : 'hold' };

  // Not seen on the payment network yet: allow one instant start per network per day, so
  // scripted fake checkouts on fresh accounts can't farm free hours.
  if (!(co.seenAt instanceof Date)) {
    const ip = clientIp(req);
    if (!ip) return { ok: false, status: 'confirming' };
    const key = await ipHash(ip, `${env.IP_SALT}|instant`);
    const used = await fs.get(`instantIps/${key}`);
    const usedAt = used?.at instanceof Date ? used.at.getTime() : 0;
    if (used && used.uid !== uid && Date.now() - usedAt < DAY) return { ok: false, status: 'confirming' };
    const mark = { uid, at: new Date() };
    if (used) await fs.update(`instantIps/${key}`, mark);
    else await fs.create('instantIps', key, mark);
  }
  await startPending(env, uid, ref, String(co.plan || 'month'));
  return { ok: true, status: 'pending' };
}

/** Switches a pass on while its payment confirms (pauses by itself after HOLD_MINUTES). */
async function startPending(env: Env, uid: string, ref: string, plan: string) {
  const fs = firestore(env);
  const now = new Date();
  await fs.update(`users/${uid}`, {
    plan: 'pro', planSource: 'pending', planExpiresAt: new Date(now.getTime() + holdMs(env)),
    planName: plan, pendingRef: ref, pendingPlan: plan, pendingSince: now,
  });
  await fs.update(`checkouts/${ref}`, { startedAt: now }).catch(() => {});
}

async function cryptoWebhook(req: Request, env: Env) {
  const raw = await req.text();
  const body = JSON.parse(raw);
  const sig = req.headers.get('x-nowpayments-sig') || '';
  const expected = await hmacSha512Hex(env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortKeysDeep(body)));
  if (!sig || !timingSafeEqual(sig.toLowerCase(), expected)) throw new HttpError(400, 'Invalid signature');

  const [uid, planRaw, ref = ''] = String(body.order_id || '').split(':');
  const plan = planOf(planRaw);
  if (!uid) throw new HttpError(400, 'Missing order id');
  const status = String(body.payment_status || '');
  const fs = firestore(env);

  if (status === 'confirming' || status === 'confirmed' || status === 'sending') {
    // Payment seen on the network: the pass switches on (or stays on) while it confirms –
    // even if the buyer never came back to the app.
    const co = /^[a-f0-9]{24}$/.test(ref) ? await fs.get(`checkouts/${ref}`) : null;
    if (!co || co.uid !== uid) return { ok: true, ignored: 'unknown checkout' };
    if (!(co.seenAt instanceof Date)) await fs.update(`checkouts/${ref}`, { seenAt: new Date() });
    const user = await fs.get(`users/${uid}`);
    if (!user || (await fs.get(`payments/ref_${ref}`))) return { ok: true };
    const until = user.planExpiresAt instanceof Date ? user.planExpiresAt.getTime() : 0;
    const paidActive = user.plan === 'pro' && user.planSource !== 'pending' && user.planSource !== 'hold' && until > Date.now();
    if (!paidActive) await startPending(env, uid, ref, String(co.plan || plan));
    return { ok: true, seen: true };
  }
  if (status === 'failed' || status === 'expired' || status === 'refunded') {
    const user = await fs.get(`users/${uid}`);
    if (user?.planSource === 'pending' && user.pendingRef === ref) {
      await fs.update(`users/${uid}`, { planSource: 'hold', planExpiresAt: new Date() });
    }
    return { ok: true, hold: true };
  }
  if (status !== 'finished') return { ok: true, ignored: status };

  // The invoice amount must match the plan price (in USD).
  const paidUsd = Number(body.price_amount);
  if (String(body.price_currency).toLowerCase() !== 'usd' || !(paidUsd >= priceFor(env, plan) - 0.01)) {
    console.error('Payment amount mismatch', JSON.stringify(body));
    return { ok: true, ignored: 'amount mismatch' };
  }
  const r = await grantPass(env, uid, plan, `np_${body.payment_id}`, 'crypto', paidUsd,
    `${PLAN_NAME[plan]} · ${body.pay_amount ?? ''} ${String(body.pay_currency || '').toUpperCase()}`);
  if (ref && !(r as any).duplicate) await fs.create('payments', `ref_${ref}`, { uid, paymentId: String(body.payment_id), createdAt: new Date() }).catch(() => {});
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Free-trial limit per network                                        */
/* ------------------------------------------------------------------ */

/** The caller's IP as reported by Cloudflare (never a client-supplied header). */
function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || '';
}

/** One-way, salted hash of the caller's IP – the IP itself is never stored. */
export async function ipHash(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function trialClaim(req: Request, env: Env) {
  const { uid } = await requireUser(req, env);
  const ip = clientIp(req);
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

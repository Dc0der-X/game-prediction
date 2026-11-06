/**
 * TableWise payments worker (Cloudflare Workers free tier).
 *
 * Routes
 *   POST /checkout          (signed-in user)  PayGate.to checkout for a Day / Month / Year pass: method "card" or "crypto"
 *   POST /pass/start        (signed-in user)  "I've paid": switch the pass on right away while the payment confirms
 *   GET  /paygate/callback  (PayGate.to)      signed payment notification – grants the pass
 *   POST /trial/claim       (signed-in user)  free-trial limit: max TRIAL_PER_IP accounts per network
 *   POST /telegram/webhook  (Telegram)        24/7 support bot (src/bot.ts)
 *
 * Instant access, automatic hold:
 *   1. The buyer pays on PayGate.to (card or crypto). Money goes straight to our own wallets.
 *   2. PayGate calls /paygate/callback (RSA-signed). We verify the signature, the checkout's own secret
 *      token, the receiving address and the amount actually paid, then grant the full pass.
 *   3. Buyers who tap "I've paid" before the confirmation arrives get the pass on at once
 *      (planSource "pending") for HOLD_MINUTES (default 60); without a payment it pauses by itself.
 *      Unconfirmed instant starts are limited to one per account and one per network per day.
 *
 * The browser is never trusted: only a verified PayGate callback can grant a full pass, and plans are
 * written to Firestore with a service account.
 */
import { firestore } from './firestore';
import { verifyFirebaseIdToken } from './auth';
import { timingSafeEqual } from './crypto';
import { BotEnv, telegramWebhook } from './bot';
import { EVM_RE, PayGateEnv, cardCheckout, cryptoCheckout, usdValue, verifyCallback } from './paygate';

export interface Env extends BotEnv, PayGateEnv {
  FIREBASE_PROJECT_ID: string;
  APP_URL: string;
  APP_ORIGINS: string;
  PRICE_DAY_USD: string;
  PRICE_MONTH_USD: string;
  PRICE_YEAR_USD: string;
  GOOGLE_SERVICE_ACCOUNT: string;
  /** Secret salt for hashing IP addresses (never stored in plain form). */
  IP_SALT: string;
  /** How many accounts on one network get the free trial (default 2). */
  TRIAL_PER_IP?: string;
  /** Minutes of instant access while a payment confirms (default 60). */
  HOLD_MINUTES?: string;
  /** Share of the price that must arrive for a pass (after provider fees). Default 0.85 card, 0.95 crypto. */
  CARD_MIN_RATIO?: string;
  CRYPTO_MIN_RATIO?: string;
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

    try {
      if (req.method === 'GET' && url.pathname === '/paygate/callback') {
        const r = await paygateCallback(req, env);
        return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'text/plain' } });
      }
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
      switch (url.pathname) {
        case '/checkout':
          return json(await createCheckout(req, env), 200, cors);
        case '/pass/start':
          return json(await passStart(req, env), 200, cors);
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
/* Passes                                                              */
/* ------------------------------------------------------------------ */

type PlanId = 'day' | 'month' | 'year';
type Method = 'card' | 'crypto';
const PLAN_DAYS: Record<PlanId, number> = { day: 1, month: 30, year: 365 };
const PLAN_NAME: Record<PlanId, string> = { day: 'Day Pass (24 hours)', month: '1 month', year: '12 months' };

function planOf(v: unknown): PlanId {
  const s = String(v);
  if (s === 'day' || s === 'year') return s;
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
    plan: 'pro', planSource: 'paygate', planExpiresAt: until, planName: plan, pendingRef: '', pendingPlan: '',
  });
  await fs.create('payments', paymentId, {
    uid, email: (user.email as string) || '', provider, amountUsd, currency: 'USD', note, createdAt: new Date(),
  });
  return { ok: true };
}

/* ---------- Checkout ---------- */

function newRef(bytes = 12): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const CHECKOUTS_PER_HOUR = 10;

async function createCheckout(req: Request, env: Env) {
  const { uid, email } = await requireUser(req, env);
  if (!env.PAYGATE_WALLET || !EVM_RE.test(env.PAYGATE_WALLET)) throw new HttpError(503, 'Payments are not set up yet. Please try again soon.');
  const fs = firestore(env);
  const me = await fs.get(`users/${uid}`);
  if (!me) throw new HttpError(404, 'User not found');
  // Rate limit: a handful of checkouts per hour is plenty for a real buyer.
  const winStart = typeof me.coWindow === 'number' ? me.coWindow : 0;
  const inWindow = Date.now() - winStart < 3_600_000;
  const count = inWindow && typeof me.coCount === 'number' ? me.coCount : 0;
  if (count >= CHECKOUTS_PER_HOUR) throw new HttpError(429, 'Too many checkouts in a short time – please try again in a little while.');
  await fs.update(`users/${uid}`, { coWindow: inWindow ? winStart : Date.now(), coCount: count + 1 });

  const body: any = await req.json().catch(() => ({}));
  const plan = planOf(body.plan);
  const method: Method = body.method === 'crypto' ? 'crypto' : 'card';
  const amount = priceFor(env, plan);
  const buyerEmail = String(email || me.email || '').trim();
  if (method === 'card' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
    throw new HttpError(400, 'Card checkout needs the email on your account.');
  }

  // A unique callback per checkout, with a secret only PayGate and we know (on top of the signature).
  const ref = newRef();
  const token = newRef(16);
  const callbackBase = `${new URL(req.url).origin}/paygate/callback`;
  const callbackUrl = `${callbackBase}?ref=${ref}&t=${token}`;
  let link: { url: string; addressIn?: string; ipnToken: string };
  try {
    link = method === 'card' ? await cardCheckout(env, callbackUrl, amount, buyerEmail) : await cryptoCheckout(env, callbackUrl, amount);
  } catch (e) {
    console.error('PayGate checkout error', e);
    throw new HttpError(502, 'Could not open checkout. Please try again.');
  }
  await fs.create('checkouts', ref, {
    uid, plan, method, amountUsd: amount, token, callbackBase, addressIn: link.addressIn || '', ipnToken: link.ipnToken,
    createdAt: new Date(), startedAt: null,
  });
  return { url: link.url, ref };
}

function holdMs(env: Env) {
  return Math.max(5, Number(env.HOLD_MINUTES || 60)) * MIN;
}

/** "I've paid": switch the pass on now; the callback confirms it (or the hold kicks in by itself). */
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
  const paidActive = user.plan === 'pro' && user.planSource !== 'pending' && user.planSource !== 'hold' && until > Date.now();
  if (paidActive) return { ok: true, status: 'active' };
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

/* ---------- PayGate callback ---------- */

/**
 * PayGate calls this with GET when a payment arrives. Checks, in order (fail closed):
 *   1. RSA signature over our registered callback URL + the raw query string
 *   2. the checkout exists and its secret token matches
 *   3. card: the receiving address is the one created for this checkout
 *   4. the amount actually received covers the plan (after provider fees)
 * Unconfirmed crypto (pending=1) only switches the pass on for HOLD_MINUTES.
 * Idempotent: a repeated callback for the same transaction changes nothing.
 */
async function paygateCallback(req: Request, env: Env): Promise<{ status: number; body: string }> {
  const raw = req.url;
  const q = raw.indexOf('?');
  if (q < 0) return { status: 400, body: 'missing query' };
  const query = raw.slice(q + 1);
  const p = new URL(raw).searchParams;
  const ref = p.get('ref') || '';
  if (!/^[a-f0-9]{24}$/.test(ref)) return { status: 400, body: 'bad ref' };

  const fs = firestore(env);
  const co = await fs.get(`checkouts/${ref}`);
  if (!co || typeof co.callbackBase !== 'string') return { status: 404, body: 'unknown checkout' };

  const signed = `${co.callbackBase}?${query}`;
  const ok = await verifyCallback(env, signed, req.headers.get('X-PayGate-Signature'), req.headers.get('X-PayGate-Key-Id'));
  if (!ok) {
    console.error('PayGate callback with a bad signature', ref);
    return { status: 403, body: 'bad signature' };
  }
  if (!timingSafeEqual(p.get('t') || '', String(co.token || ''))) return { status: 403, body: 'bad token' };

  const uid = String(co.uid);
  const plan = planOf(co.plan);
  const method: Method = co.method === 'crypto' ? 'crypto' : 'card';
  const coin = (p.get('coin') || '').toLowerCase();
  const valueCoin = Number(p.get('value_coin'));
  const txid = (p.get('txid_in') || '').toLowerCase();
  if (method === 'card' && co.addressIn && (p.get('address_in') || '').toLowerCase() !== co.addressIn) {
    console.error('PayGate callback for a different receiving address', ref);
    return { status: 200, body: 'ignored: address' };
  }

  // Unconfirmed crypto payment: switch the pass on while it confirms.
  if (p.get('pending') === '1') {
    if (!(co.seenAt instanceof Date)) await fs.update(`checkouts/${ref}`, { seenAt: new Date() });
    const user = await fs.get(`users/${uid}`);
    if (!user || (await fs.get(`payments/ref_${ref}`))) return { status: 200, body: 'ok' };
    const until = user.planExpiresAt instanceof Date ? user.planExpiresAt.getTime() : 0;
    const paidActive = user.plan === 'pro' && user.planSource !== 'pending' && user.planSource !== 'hold' && until > Date.now();
    if (!paidActive) await startPending(env, uid, ref, plan);
    return { status: 200, body: 'ok: pending' };
  }

  const price = priceFor(env, plan);
  const usd = await usdValue(env, coin, valueCoin, price);
  const minRatio = Number(method === 'card' ? env.CARD_MIN_RATIO || 0.85 : env.CRYPTO_MIN_RATIO || 0.95);
  if (usd === null || usd < price * minRatio) {
    console.error('PayGate underpaid or unpriced', ref, coin, valueCoin, usd);
    await fs.update(`checkouts/${ref}`, { underpaid: `${valueCoin} ${coin}`, seenAt: new Date() }).catch(() => {});
    return { status: 200, body: 'ignored: amount' };
  }
  const paymentId = `pg_${(txid || ref).replace(/[^a-z0-9]/g, '').slice(0, 80)}`;
  const r = await grantPass(env, uid, plan, paymentId, `paygate-${method}`, Math.round(usd * 100) / 100,
    `${PLAN_NAME[plan]} · ${valueCoin} ${coin.toUpperCase()}`);
  if (!(r as any).duplicate) await fs.create('payments', `ref_${ref}`, { uid, paymentId, createdAt: new Date() }).catch(() => {});
  return { status: 200, body: 'ok' };
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

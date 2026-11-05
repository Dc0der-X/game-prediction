// End-to-end test of the bundled worker with mocked Google / NOWPayments APIs.
// Run: npx wrangler deploy --dry-run --outdir dist && node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({
  client_email: 'worker@test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});
const env = {
  FIREBASE_PROJECT_ID: 'demo', APP_URL: 'https://app.test', APP_ORIGINS: 'https://app.test',
  PRICE_DAY_USD: '20', PRICE_MONTH_USD: '140', PRICE_YEAR_USD: '999', HOLD_MINUTES: '60',
  NOWPAYMENTS_API_KEY: 'k', NOWPAYMENTS_IPN_SECRET: 'ipn-secret',
  GOOGLE_SERVICE_ACCOUNT: SA, IP_SALT: 'salt', TRIAL_PER_IP: '2',
};

// In-memory Firestore behind a fake fetch.
const docs = new Map();
const base = 'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents/';
// Fake Firebase Auth signing key, served where the worker looks up Google's public keys.
const authKeys = await generateKeyPair('RS256');
const authJwk = { ...(await exportJWK(authKeys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const idToken = (uid) => new SignJWT({ email: `${uid}@x.y` }).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
  .setIssuer('https://securetoken.google.com/demo').setAudience('demo').setSubject(uid).setIssuedAt().setExpirationTime('1h').sign(authKeys.privateKey);

let lastInvoice = null;
const tgSent = [];
let claudeReply = 'Hey! 👋 Sign up free at https://app.test/signup';
let lastClaude = null;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = init.method || 'GET';
  if (url.startsWith('https://www.googleapis.com/service_accounts/')) return Response.json({ keys: [authJwk] });
  if (url.startsWith('https://api.telegram.org/bot')) {
    tgSent.push({ method: url.split('/').pop(), body: JSON.parse(init.body || (await input.text?.()) || '{}') });
    return Response.json({ ok: true });
  }
  if (url.startsWith('https://api.anthropic.com/v1/messages')) {
    const body = init.body ?? (await input.clone().text());
    lastClaude = { body: JSON.parse(typeof body === 'string' ? body : new TextDecoder().decode(body)), headers: new Headers(init.headers ?? input.headers) };
    return Response.json({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn',
      content: [{ type: 'text', text: claudeReply }], usage: { input_tokens: 10, output_tokens: 10 } });
  }
  if (url === 'https://api.nowpayments.io/v1/invoice') {
    lastInvoice = JSON.parse(init.body);
    return Response.json({ id: 1, invoice_url: 'https://nowpayments.io/payment/?iid=1' });
  }
  if (url === 'https://oauth2.googleapis.com/token')
    return Response.json({ access_token: 'tok', expires_in: 3600 });
  if (url.startsWith(base)) {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.split('/documents/')[1]);
    if (method === 'GET') return docs.has(path) ? Response.json({ fields: docs.get(path) }) : new Response('', { status: 404 });
    if (method === 'PATCH') {
      if (!docs.has(path)) return new Response('missing', { status: 404 });
      docs.set(path, { ...docs.get(path), ...JSON.parse(init.body).fields });
      return Response.json({});
    }
    if (method === 'POST') {
      const id = u.searchParams.get('documentId');
      const full = `${path}/${id}`;
      if (docs.has(full)) return new Response('exists', { status: 409 });
      docs.set(full, JSON.parse(init.body).fields);
      return Response.json({});
    }
  }
  throw new Error('Unexpected fetch ' + method + ' ' + url);
};

const worker = (await import('../dist/index.js')).default;

function sign(body) {
  const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.keys(v).sort().reduce((a, k) => ((a[k] = sort(v[k])), a), {}) : v;
  return createHmac('sha512', env.NOWPAYMENTS_IPN_SECRET).update(JSON.stringify(sort(body))).digest('hex');
}
function ipn(body, sig = sign(body)) {
  return worker.fetch(new Request('https://w.test/crypto/webhook', {
    method: 'POST', headers: { 'x-nowpayments-sig': sig, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env);
}
const paid = (over = {}) => ({
  payment_id: 111, payment_status: 'finished', order_id: 'user1:month:123', price_amount: 140, price_currency: 'usd',
  pay_amount: 0.0002, pay_currency: 'btc', ...over,
});

docs.set('users/user1', { email: { stringValue: 'a@b.c' }, role: { stringValue: 'customer' } });

test('rejects a forged signature', async () => {
  const res = await ipn(paid(), 'deadbeef');
  assert.equal(res.status, 400);
  assert.equal(docs.get('users/user1').plan, undefined);
});

test('finished payment unlocks 30 days of Pro and records the payment', async () => {
  const res = await ipn(paid());
  assert.equal(res.status, 200);
  const u = docs.get('users/user1');
  assert.equal(u.plan.stringValue, 'pro');
  const days = (Date.parse(u.planExpiresAt.timestampValue) - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days < 30.1, `expected ~30 days, got ${days}`);
  assert.equal(docs.get('payments/np_111').amountUsd.integerValue, '140');
});

test('duplicate webhook does not extend twice', async () => {
  const before = docs.get('users/user1').planExpiresAt.timestampValue;
  await ipn(paid());
  assert.equal(docs.get('users/user1').planExpiresAt.timestampValue, before);
});

test('second payment stacks on top of remaining time', async () => {
  await ipn(paid({ payment_id: 222 }));
  const days = (Date.parse(docs.get('users/user1').planExpiresAt.timestampValue) - Date.now()) / 86400000;
  assert.ok(days > 59.9 && days < 60.1, `expected ~60 days, got ${days}`);
});

test('underpaid yearly order is ignored', async () => {
  const before = docs.get('users/user1').planExpiresAt.timestampValue;
  const res = await ipn(paid({ payment_id: 333, order_id: 'user1:year:1', price_amount: 140 }));
  assert.equal(res.status, 200);
  assert.equal(docs.get('users/user1').planExpiresAt.timestampValue, before);
  assert.equal(docs.has('payments/np_333'), false);
});

test('day pass adds exactly one day', async () => {
  docs.set('users/user2', { email: { stringValue: 'd@e.f' }, role: { stringValue: 'customer' } });
  await ipn(paid({ payment_id: 555, order_id: 'user2:day:9', price_amount: 20 }));
  const hours = (Date.parse(docs.get('users/user2').planExpiresAt.timestampValue) - Date.now()) / 3600000;
  assert.ok(hours > 23.9 && hours < 24.1, `expected ~24h, got ${hours}`);
});

test('non-finished statuses are ignored', async () => {
  const res = await ipn(paid({ payment_id: 444, payment_status: 'partially_paid' }));
  assert.equal(res.status, 200);
  assert.equal(docs.has('payments/np_444'), false);
});

test('invoice endpoint requires login', async () => {
  const res = await worker.fetch(new Request('https://w.test/crypto/invoice', { method: 'POST', body: '{}' }), env);
  assert.equal(res.status, 401);
});


test('free trial: only 2 accounts per network, IP never stored', async () => {
  const claim = async (uid, ip) => {
    docs.set(`users/${uid}`, docs.get(`users/${uid}`) || { email: { stringValue: `${uid}@x.y` } });
    const res = await worker.fetch(new Request('https://w.test/trial/claim', {
      method: 'POST', headers: { Authorization: `Bearer ${await idToken(uid)}`, 'CF-Connecting-IP': ip, 'content-type': 'application/json' }, body: '{}',
    }), env);
    return (await res.json()).ok;
  };
  assert.equal(await claim('t1', '1.2.3.4'), true);
  assert.equal(await claim('t2', '1.2.3.4'), true);
  assert.equal(await claim('t3', '1.2.3.4'), false);
  assert.equal(await claim('t1', '1.2.3.4'), true, 'same account again is still fine');
  assert.equal(await claim('t4', '5.6.7.8'), true, 'another network gets its own 2');
  assert.equal(docs.get('users/t3').trialOk.booleanValue, false);
  assert.equal(docs.get('users/t2').trialOk.booleanValue, true);
  const stored = JSON.stringify([...docs.entries()].filter(([k]) => k.startsWith('trialIps/')));
  assert.ok(!stored.includes('1.2.3.4') && !stored.includes('5.6.7.8'), 'raw IPs must not be stored');
});

/* ---------- Instant access with automatic hold ---------- */

const call = async (uid, path, body) => {
  const res = await worker.fetch(new Request(`https://w.test${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${await idToken(uid)}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env);
  return { status: res.status, body: await res.json() };
};
const minutesLeft = (uid) => (Date.parse(docs.get(`users/${uid}`).planExpiresAt.timestampValue) - Date.now()) / 60000;

test('pass switches on instantly after checkout, then the payment confirms it', async () => {
  docs.set('users/buyer', { email: { stringValue: 'b@x.y' }, role: { stringValue: 'customer' } });
  const co = await call('buyer', '/checkout', { plan: 'month' });
  assert.equal(co.status, 200);
  assert.match(co.body.ref, /^[a-f0-9]{24}$/);
  assert.equal(lastInvoice.success_url, `https://app.test/pro?paid=${co.body.ref}`);

  const start = await call('buyer', '/pass/start', { ref: co.body.ref });
  assert.equal(start.body.status, 'pending');
  const u = docs.get('users/buyer');
  assert.equal(u.plan.stringValue, 'pro');
  assert.equal(u.planSource.stringValue, 'pending');
  const m = minutesLeft('buyer');
  assert.ok(m > 59 && m <= 60, `expected ~60 min, got ${m}`);

  // A second checkout can't start another unpaid hour.
  const co2 = await call('buyer', '/checkout', { plan: 'day' });
  assert.equal((await call('buyer', '/pass/start', { ref: co2.body.ref })).body.status, 'waiting');

  // Seen on the network → the pending time is topped up.
  await ipn(paid({ payment_id: 901, payment_status: 'confirming', order_id: `buyer:month:${co.body.ref}` }));
  assert.equal(docs.get('users/buyer').planSource.stringValue, 'pending');

  // Finished → the full month, no double counting, pending cleared.
  await ipn(paid({ payment_id: 901, order_id: `buyer:month:${co.body.ref}` }));
  const done = docs.get('users/buyer');
  assert.equal(done.planSource.stringValue, 'crypto');
  assert.equal(done.pendingRef.stringValue, '');
  const days = minutesLeft('buyer') / 1440;
  assert.ok(days > 29.9 && days < 30.1, `expected ~30 days, got ${days}`);
  assert.equal((await call('buyer', '/pass/start', { ref: co.body.ref })).body.status, 'paid');
});

test('payment not received: the pass goes on hold by itself', async () => {
  docs.set('users/nopay', { email: { stringValue: 'n@x.y' }, role: { stringValue: 'customer' } });
  const co = await call('nopay', '/checkout', { plan: 'year' });
  await call('nopay', '/pass/start', { ref: co.body.ref });
  await ipn(paid({ payment_id: 902, payment_status: 'expired', order_id: `nopay:year:${co.body.ref}`, price_amount: 999 }));
  const u = docs.get('users/nopay');
  assert.equal(u.planSource.stringValue, 'hold');
  assert.ok(minutesLeft('nopay') <= 0, 'access must stop');
  // Paying later still switches the full pass on.
  await ipn(paid({ payment_id: 903, order_id: `nopay:year:${co.body.ref}`, price_amount: 999 }));
  assert.equal(docs.get('users/nopay').planSource.stringValue, 'crypto');
  assert.ok(minutesLeft('nopay') / 1440 > 364);
});

test("can't start a pass with someone else's checkout", async () => {
  const co = await call('buyer', '/checkout', { plan: 'day' });
  docs.set('users/thief', { email: { stringValue: 't@x.y' }, role: { stringValue: 'customer' } });
  const r = await call('thief', '/pass/start', { ref: co.body.ref });
  assert.equal(r.status, 404);
  assert.equal(docs.get('users/thief').plan, undefined);
});

/* ---------- Telegram support bot ---------- */

const botEnv = { ...env, TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_WEBHOOK_SECRET: 'hook', ANTHROPIC_API_KEY: 'sk-test', TELEGRAM_OWNER_CHAT_ID: '999' };
const tgUpdate = (text, secret = 'hook', chat = 42) => worker.fetch(new Request('https://w.test/telegram/webhook', {
  method: 'POST', headers: { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
  body: JSON.stringify({ message: { text, chat: { id: chat, type: 'private' }, from: { username: 'sam' } } }),
}), botEnv);

test('bot ignores calls without the Telegram secret', async () => {
  tgSent.length = 0;
  const res = await tgUpdate('hi', 'wrong');
  assert.equal(res.status, 200);
  assert.equal(tgSent.length, 0);
});

test('bot answers with Claude and remembers the chat', async () => {
  tgSent.length = 0;
  await tgUpdate('/start');
  const reply = tgSent.find((m) => m.method === 'sendMessage');
  assert.equal(reply.body.chat_id, 42);
  assert.match(reply.body.text, /signup/);
  assert.equal(lastClaude.body.model, 'claude-opus-5-5');
  assert.equal(lastClaude.body.fallbacks, 'default');
  assert.match(lastClaude.headers.get('anthropic-beta') || '', /server-side-fallback-2026-07-01/);
  await tgUpdate('How much is a month?');
  assert.equal(lastClaude.body.messages.length, 3, 'previous turn is sent as context');
  const stored = JSON.stringify([...docs.entries()].filter(([k]) => k.startsWith('botChats/')));
  assert.ok(!stored.includes('"42"'), 'chat id is stored hashed');
});

test('bot pings the owner when a person is needed', async () => {
  tgSent.length = 0;
  claudeReply = "Sorry about that! What's the email on your account? A teammate will follow up. [[HUMAN]]";
  await tgUpdate('I paid but nothing happened', 'hook', 77);
  const toUser = tgSent.find((m) => m.method === 'sendMessage' && m.body.chat_id === 77);
  assert.ok(!toUser.body.text.includes('[[HUMAN]]'));
  assert.ok(tgSent.some((m) => m.method === 'sendMessage' && m.body.chat_id === '999'), 'owner notified');
});

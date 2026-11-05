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
  PRICE_DAY_USD: '20', PRICE_MONTH_USD: '140', PRICE_YEAR_USD: '999', PAYPAL_ENV: 'sandbox', PAYPAL_CLIENT_ID: '', PAYPAL_PLAN_ID: 'P-1',
  PAYPAL_WEBHOOK_ID: '', PAYPAL_SECRET: '', NOWPAYMENTS_API_KEY: 'k', NOWPAYMENTS_IPN_SECRET: 'ipn-secret',
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

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = init.method || 'GET';
  if (url.startsWith('https://www.googleapis.com/service_accounts/')) return Response.json({ keys: [authJwk] });
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

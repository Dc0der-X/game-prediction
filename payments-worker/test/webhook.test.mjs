// End-to-end test of the bundled worker with mocked Google / PayGate.to / Telegram / Claude APIs.
// Run: npm test   (= wrangler deploy --dry-run --outdir dist && node --test test/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({
  client_email: 'worker@test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});
// Our stand-in for PayGate's callback signing key.
const paygateKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const WALLET = '0x1111111111111111111111111111111111111111';
const env = {
  FIREBASE_PROJECT_ID: 'demo', APP_URL: 'https://app.test', APP_ORIGINS: 'https://app.test',
  PRICE_DAY_USD: '20', PRICE_MONTH_USD: '140', PRICE_YEAR_USD: '999', HOLD_MINUTES: '60',
  GOOGLE_SERVICE_ACCOUNT: SA, IP_SALT: 'salt', TRIAL_PER_IP: '2',
  PAYGATE_WALLET: WALLET, PAYGATE_BTC: 'bc1qexampleexampleexampleexampleexample0',
  PAYGATE_TEST_KEY_PEM: paygateKeys.publicKey.export({ type: 'spki', format: 'pem' }),
};

// In-memory Firestore behind a fake fetch.
const docs = new Map();
const base = 'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents/';
// Fake Firebase Auth signing key, served where the worker looks up Google's public keys.
const authKeys = await generateKeyPair('RS256');
const authJwk = { ...(await exportJWK(authKeys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const idToken = (uid) => new SignJWT({ email: `${uid}@x.y` }).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
  .setIssuer('https://securetoken.google.com/demo').setAudience('demo').setSubject(uid).setIssuedAt().setExpirationTime('1h').sign(authKeys.privateKey);

const tgSent = [];
let claudeReply = 'Hey! 👋 Sign up free at https://app.test/signup';
let lastClaude = null;
// PayGate.to fakes
let walletN = 0;
const wallets = new Map(); // callback URL -> polygon address
let lastWalletCall = null;
let lastHosted = null;
let btcPerPrice = 0.01; // what the plan price is worth in BTC
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
  if (url.startsWith('https://api.paygate.to/control/wallet.php?')) {
    const u = new URL(url);
    lastWalletCall = { address: u.searchParams.get('address'), callback: u.searchParams.get('callback') };
    const poly = '0x' + String(++walletN).padStart(40, 'a');
    wallets.set(lastWalletCall.callback, poly);
    return Response.json({ address_in: `ENC${walletN}%2Fabc%3D%3D`, polygon_address_in: poly, callback_url: lastWalletCall.callback, ipn_token: `IPN${walletN}` });
  }
  if (url === 'https://api.paygate.to/crypto/multi-hosted-wallet.php') {
    lastHosted = JSON.parse(init.body);
    return Response.json({ payment_token: 'TOKEN%2Bxyz%3D', callback_url: lastHosted.callback, ipn_token: 'IPNC' });
  }
  if (url.startsWith('https://api.paygate.to/crypto/btc/convert.php?')) {
    return Response.json({ status: 'success', value_coin: String(btcPerPrice), exchange_rate: '0.00001' });
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

/* ---------- helpers ---------- */

const call = async (uid, path, body, ip = '9.9.9.9') => {
  const res = await worker.fetch(new Request(`https://w.test${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${await idToken(uid)}`, 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  }), env);
  return { status: res.status, body: await res.json() };
};
const user = (uid) => docs.set(`users/${uid}`, { email: { stringValue: `${uid}@x.y` }, role: { stringValue: 'customer' } });
const minutesLeft = (uid) => (Date.parse(docs.get(`users/${uid}`).planExpiresAt.timestampValue) - Date.now()) / 60000;
const str = (uid, f) => docs.get(`users/${uid}`)?.[f]?.stringValue;

/** The callback URL PayGate would call for a checkout, plus its payment data. */
function callbackFor(ref, extra) {
  const co = docs.get(`checkouts/${ref}`);
  const base = `${co.callbackBase.stringValue}?ref=${ref}&t=${co.token.stringValue}`;
  return `${base}&${new URLSearchParams(extra).toString()}`;
}
/** Sends a callback signed like PayGate does (or with a forged signature). */
async function pgCallback(fullUrl, { forge = false, sign = true } = {}) {
  const s = createSign('RSA-SHA256');
  s.update(forge ? fullUrl + 'x' : fullUrl);
  const headers = { 'User-Agent': 'paygate.to', 'X-PayGate-Key-Id': 'v1' };
  if (sign) headers['X-PayGate-Signature'] = s.sign(paygateKeys.privateKey, 'base64');
  const res = await worker.fetch(new Request(fullUrl, { method: 'GET', headers }), env);
  return { status: res.status, body: await res.text() };
}
const cardPaid = (ref, value, txid, address) => callbackFor(ref, {
  value_coin: String(value), coin: 'polygon_usdc', txid_in: txid, txid_out: '0xout',
  address_in: address ?? docs.get(`checkouts/${ref}`).addressIn.stringValue, value_forwarded_coin: String(value),
  address_out: JSON.stringify({ [WALLET]: '1.0000' }),
});

/* ---------- Card checkout ---------- */

test('card checkout: one-off wallet with our payout wallet and a secret callback, hosted card page', async () => {
  user('buyer');
  const co = await call('buyer', '/checkout', { plan: 'month', method: 'card' });
  assert.equal(co.status, 200, JSON.stringify(co.body));
  assert.match(co.body.ref, /^[a-f0-9]{24}$/);
  assert.equal(lastWalletCall.address, WALLET);
  assert.match(lastWalletCall.callback, new RegExp(`^https://w\\.test/paygate/callback\\?ref=${co.body.ref}&t=[a-f0-9]{32}$`));
  const u = new URL(co.body.url);
  assert.equal(u.origin + u.pathname, 'https://checkout.paygate.to/pay.php');
  assert.ok(co.body.url.includes('address=ENC'), 'encrypted address passed on as received');
  assert.equal(u.searchParams.get('amount'), '140.00');
  assert.equal(u.searchParams.get('currency'), 'USD');
  assert.equal(u.searchParams.get('email'), 'buyer@x.y');
});

test('signed card payment unlocks 30 days and records it once', async () => {
  const co = await call('buyer', '/checkout', { plan: 'month', method: 'card' });
  const url = cardPaid(co.body.ref, 138.5, '0xtx1');
  const r = await pgCallback(url);
  assert.equal(r.status, 200, r.body);
  assert.equal(str('buyer', 'plan'), 'pro');
  assert.equal(str('buyer', 'planSource'), 'paygate');
  const days = minutesLeft('buyer') / 1440;
  assert.ok(days > 29.9 && days < 30.1, `expected ~30 days, got ${days}`);
  assert.ok(docs.has('payments/pg_0xtx1'));
  // The same callback again (PayGate may retry) changes nothing.
  const before = docs.get('users/buyer').planExpiresAt.timestampValue;
  await pgCallback(url);
  assert.equal(docs.get('users/buyer').planExpiresAt.timestampValue, before);
});

test('forged or unsigned callbacks are refused', async () => {
  user('victim');
  const co = await call('victim', '/checkout', { plan: 'year', method: 'card' });
  const url = cardPaid(co.body.ref, 999, '0xforged');
  assert.equal((await pgCallback(url, { forge: true })).status, 403);
  assert.equal((await pgCallback(url, { sign: false })).status, 403);
  assert.equal(str('victim', 'plan'), undefined);
});

test('a callback with the wrong secret token is refused even if signed', async () => {
  user('tok');
  const co = await call('tok', '/checkout', { plan: 'day', method: 'card' });
  const url = cardPaid(co.body.ref, 20, '0xtok').replace(/&t=[a-f0-9]+/, '&t=' + 'f'.repeat(32));
  assert.equal((await pgCallback(url)).status, 403);
  assert.equal(str('tok', 'plan'), undefined);
});

test('edited card price: paying $1 for a Monthly pass grants nothing', async () => {
  user('cheap');
  const co = await call('cheap', '/checkout', { plan: 'month', method: 'card' });
  const r = await pgCallback(cardPaid(co.body.ref, 0.95, '0xcheap'));
  assert.equal(r.status, 200);
  assert.match(r.body, /amount/);
  assert.equal(str('cheap', 'plan'), undefined);
  assert.ok(docs.get(`checkouts/${co.body.ref}`).underpaid);
});

test('a payment to some other receiving address is ignored', async () => {
  user('addr');
  const co = await call('addr', '/checkout', { plan: 'day', method: 'card' });
  const r = await pgCallback(cardPaid(co.body.ref, 20, '0xaddr', '0x' + '9'.repeat(40)));
  assert.match(r.body, /address/);
  assert.equal(str('addr', 'plan'), undefined);
});

test('a second payment stacks on the time left', async () => {
  const co = await call('buyer', '/checkout', { plan: 'month', method: 'card' });
  await pgCallback(cardPaid(co.body.ref, 140, '0xtx2'));
  const days = minutesLeft('buyer') / 1440;
  assert.ok(days > 59.9 && days < 60.1, `expected ~60 days, got ${days}`);
});

/* ---------- Crypto checkout ---------- */

test('crypto checkout: hosted multi-coin page with our wallets and the plan price', async () => {
  user('coin');
  const co = await call('coin', '/checkout', { plan: 'year', method: 'crypto' });
  assert.equal(co.status, 200, JSON.stringify(co.body));
  assert.equal(lastHosted.evm, WALLET);
  assert.equal(lastHosted.btc, env.PAYGATE_BTC);
  assert.equal(lastHosted.fiat_amount, 999);
  assert.equal(lastHosted.fiat_currency, 'USD');
  assert.ok(lastHosted.callback.includes(`ref=${co.body.ref}`));
  assert.equal(co.body.url, 'https://checkout.paygate.to/crypto/hosted.php?payment_token=TOKEN%2Bxyz%3D&add_fees=1');
});

test('crypto: unconfirmed payment switches the pass on, confirmed BTC payment grants the year', async () => {
  const ref = (await call('coin', '/checkout', { plan: 'year', method: 'crypto' })).body.ref;
  const data = { coin: 'btc', value_coin: '0.00998', txid_in: 'btctx1', txid_out: 'out', address_in: 'bc1qtemp', value_forwarded_coin: '0.0099' };
  await pgCallback(callbackFor(ref, { ...data, pending: '1' }));
  assert.equal(str('coin', 'planSource'), 'pending');
  assert.ok(minutesLeft('coin') > 59);
  await pgCallback(callbackFor(ref, { ...data, pending: '0' }));
  assert.equal(str('coin', 'planSource'), 'paygate');
  assert.ok(minutesLeft('coin') / 1440 > 364);
});

test('crypto: underpaid BTC grants nothing', async () => {
  user('lowbtc');
  const ref = (await call('lowbtc', '/checkout', { plan: 'month', method: 'crypto' })).body.ref;
  await pgCallback(callbackFor(ref, { coin: 'btc', value_coin: '0.004', txid_in: 'btctx2', pending: '0' }));
  assert.equal(str('lowbtc', 'plan'), undefined);
});

test('crypto: stablecoins count 1:1', async () => {
  user('usdt');
  const ref = (await call('usdt', '/checkout', { plan: 'day', method: 'crypto' })).body.ref;
  await pgCallback(callbackFor(ref, { coin: 'trc20_usdt', value_coin: '19.6', txid_in: 'trontx', pending: '0' }));
  assert.equal(str('usdt', 'planSource'), 'paygate');
});

/* ---------- "I've paid" instant start and automatic pause ---------- */

test("I've paid: pass on at once, one unconfirmed start per account, confirmed later", async () => {
  user('fast');
  const co = await call('fast', '/checkout', { plan: 'month', method: 'card' });
  const start = await call('fast', '/pass/start', { ref: co.body.ref });
  assert.equal(start.body.status, 'pending');
  assert.equal(str('fast', 'planSource'), 'pending');
  const m = minutesLeft('fast');
  assert.ok(m > 59 && m <= 60, `expected ~60 min, got ${m}`);
  const co2 = await call('fast', '/checkout', { plan: 'day', method: 'card' });
  assert.equal((await call('fast', '/pass/start', { ref: co2.body.ref })).body.status, 'waiting');
  await pgCallback(cardPaid(co.body.ref, 140, '0xfast'));
  assert.equal(str('fast', 'planSource'), 'paygate');
  assert.equal(str('fast', 'pendingRef'), '');
  assert.equal((await call('fast', '/pass/start', { ref: co.body.ref })).body.status, 'paid');
});

test('without a payment the instant pass simply runs out (pauses) after 60 minutes', async () => {
  user('nopay');
  const co = await call('nopay', '/checkout', { plan: 'year', method: 'card' }, '8.8.4.4');
  assert.equal((await call('nopay', '/pass/start', { ref: co.body.ref }, '8.8.4.4')).body.status, 'pending');
  const m = minutesLeft('nopay');
  assert.ok(m > 59 && m <= 60);
  // Paying later still switches the full pass on.
  await pgCallback(cardPaid(co.body.ref, 999, '0xlate'));
  assert.ok(minutesLeft('nopay') / 1440 > 364);
});

test("can't start a pass with someone else's checkout", async () => {
  const co = await call('buyer', '/checkout', { plan: 'day', method: 'card' });
  user('thief');
  const r = await call('thief', '/pass/start', { ref: co.body.ref });
  assert.equal(r.status, 404);
  assert.equal(str('thief', 'plan'), undefined);
});

test('fake checkouts: one unconfirmed instant start per network per day', async () => {
  user('farm1');
  user('farm2');
  const a = await call('farm1', '/checkout', { plan: 'day', method: 'card' }, '7.7.7.7');
  assert.equal((await call('farm1', '/pass/start', { ref: a.body.ref }, '7.7.7.7')).body.status, 'pending');
  const b = await call('farm2', '/checkout', { plan: 'day', method: 'card' }, '7.7.7.7');
  assert.equal((await call('farm2', '/pass/start', { ref: b.body.ref }, '7.7.7.7')).body.status, 'confirming');
  assert.equal(str('farm2', 'plan'), undefined, 'second account on the network gets nothing until payment arrives');
  await pgCallback(cardPaid(b.body.ref, 20, '0xfarm2'));
  assert.equal(str('farm2', 'planSource'), 'paygate');
  const stored = JSON.stringify([...docs.entries()].filter(([k]) => k.startsWith('instantIps/')));
  assert.ok(!stored.includes('7.7.7.7'), 'raw IPs must not be stored');
});

test('checkout spam is rate limited', async () => {
  user('spam');
  for (let i = 0; i < 10; i++) assert.equal((await call('spam', '/checkout', { plan: 'day', method: 'card' })).status, 200);
  assert.equal((await call('spam', '/checkout', { plan: 'day', method: 'card' })).status, 429);
});

test('checkout requires login', async () => {
  const res = await worker.fetch(new Request('https://w.test/checkout', { method: 'POST', body: '{}' }), env);
  assert.equal(res.status, 401);
});

test('no payout wallet configured: checkout says so instead of breaking', async () => {
  user('cfg');
  const res = await worker.fetch(new Request('https://w.test/checkout', {
    method: 'POST', headers: { Authorization: `Bearer ${await idToken('cfg')}`, 'content-type': 'application/json' }, body: '{}',
  }), { ...env, PAYGATE_WALLET: '' });
  assert.equal(res.status, 503);
});

/* ---------- Free-trial limit ---------- */

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
  const stored = JSON.stringify([...docs.entries()].filter(([k]) => k.startsWith('trialIps/')));
  assert.ok(!stored.includes('1.2.3.4') && !stored.includes('5.6.7.8'), 'raw IPs must not be stored');
});

test('free-trial limit ignores a faked X-Forwarded-For header', async () => {
  docs.set('users/fwd', { email: { stringValue: 'fwd@x.y' } });
  const res = await worker.fetch(new Request('https://w.test/trial/claim', {
    method: 'POST', headers: { Authorization: `Bearer ${await idToken('fwd')}`, 'X-Forwarded-For': '1.1.1.1', 'content-type': 'application/json' }, body: '{}',
  }), env);
  assert.equal(res.status, 400);
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

test('bot spam is rate limited (protects the Claude bill)', async () => {
  tgSent.length = 0;
  claudeReply = 'Hi!';
  let claudeCalls = 0;
  for (let i = 0; i < 23; i++) {
    lastClaude = null;
    await tgUpdate(`msg ${i}`, 'hook', 555);
    if (lastClaude) claudeCalls++;
  }
  assert.equal(claudeCalls, 20, `Claude called ${claudeCalls} times`);
  const slowDown = tgSent.filter((m) => m.method === 'sendMessage' && /You're quick/.test(m.body.text));
  assert.equal(slowDown.length, 1, 'one friendly slow-down message, not one per spam message');
});

test("PayGate's real published key is used in production and rejects signatures it didn't make", async () => {
  user('realkey');
  const prodEnv = { ...env };
  delete prodEnv.PAYGATE_TEST_KEY_PEM;
  const res = await worker.fetch(new Request('https://w.test/checkout', {
    method: 'POST', headers: { Authorization: `Bearer ${await idToken('realkey')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'day', method: 'card' }),
  }), prodEnv);
  const { ref } = await res.json();
  const url = cardPaid(ref, 20, '0xrealkey');
  const s = createSign('RSA-SHA256');
  s.update(url);
  const r = await worker.fetch(new Request(url, { headers: { 'X-PayGate-Signature': s.sign(paygateKeys.privateKey, 'base64'), 'X-PayGate-Key-Id': 'v1' } }), prodEnv);
  assert.equal(r.status, 403);
  const unknownKey = await worker.fetch(new Request(url, { headers: { 'X-PayGate-Signature': 'AAAA', 'X-PayGate-Key-Id': 'v9' } }), prodEnv);
  assert.equal(unknownKey.status, 403);
  assert.equal(str('realkey', 'plan'), undefined);
});

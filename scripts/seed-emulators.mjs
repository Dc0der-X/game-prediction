/**
 * Fills the LOCAL Firebase emulators with demo data (never touches production).
 *   npm run emulators        # terminal 1
 *   npm run seed:emulators   # terminal 2
 *
 * Demo logins:
 *   admin@tablewise.test / admin123   – admin dashboard
 *   demo@tablewise.test  / demo1234   – customer on a fresh 7-day trial
 */
const PROJECT = 'demo-tablewise';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const DAY = 86_400_000;

const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
};

async function account(email, password, name) {
  let r = await fetch(`${AUTH}/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, displayName: name, returnSecureToken: true }),
  });
  if (!r.ok) {
    r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  }
  const j = await r.json();
  if (!j.localId) throw new Error(`Could not create ${email}: ${JSON.stringify(j)}`);
  return j.localId;
}

async function put(path, data) {
  const r = await fetch(`${FS}/${path}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }),
  });
  if (!r.ok) throw new Error(`write ${path}: ${r.status} ${await r.text()}`);
}

const now = Date.now();
const ago = (d) => new Date(now - d * DAY);

// Admin + demo player
const adminUid = await account('admin@tablewise.test', 'admin123', 'Admin');
await put(`users/${adminUid}`, { name: 'Admin', email: 'admin@tablewise.test', phone: '', telegram: '', role: 'admin', ageConfirmed: true, createdAt: ago(40) });
const demoUid = await account('demo@tablewise.test', 'demo1234', 'Demo Player');
await put(`users/${demoUid}`, { name: 'Demo Player', email: 'demo@tablewise.test', phone: '', telegram: '@demo', role: 'customer', ageConfirmed: true, createdAt: new Date() });

// Sample customers
const people = [
  ['Arjun Mehta', 1, null], ['Sofia Lopez', 2, null], ['Liam Chen', 3, null], ['Priya Nair', 5, null],
  ['Noah Smith', 9, 'paypal'], ['Emma Rossi', 12, 'crypto'], ['Kabir Shah', 14, 'paypal'], ['Mia Novak', 18, null],
  ['Omar Haddad', 20, 'crypto12'], ['Ava Brown', 23, null], ['Ravi Kumar', 26, 'paypal'], ['Lucas Silva', 29, null],
];
const casinos = ['Evolution live tables', 'Ezugi', 'Pragmatic Play Live'];
const games = [['baccarat', 'banker'], ['roulette', 'red'], ['dragon-tiger', 'dragon'], ['sicbo', 'small']];
let n = 0;
for (const [name, daysAgo, paid] of people) {
  const email = name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com';
  const uid = await account(email, 'password123', name);
  const created = ago(daysAgo);
  const profile = { name, email, phone: `+1 555 01${String(10 + n).padStart(2, '0')}`, telegram: '', role: 'customer', ageConfirmed: true, createdAt: created };
  if (paid) {
    const paidAt = new Date(created.getTime() + 7 * DAY);
    const months = paid === 'crypto12' ? 12 : 1;
    const amount = months === 12 ? 99 : 12;
    Object.assign(profile, {
      plan: 'pro', planSource: paid.startsWith('crypto') ? 'crypto' : 'paypal',
      planExpiresAt: new Date(paidAt.getTime() + (months === 12 ? 365 : 30) * DAY),
      ...(paid === 'paypal' ? { paypalStatus: 'ACTIVE' } : {}),
    });
    await put(`payments/demo_${n}`, {
      uid, email, provider: paid.startsWith('crypto') ? 'crypto' : 'paypal', amountUsd: amount, currency: 'USD',
      note: paid.startsWith('crypto') ? `${months === 12 ? '12 months' : '1 month'} · USDT` : 'Subscription I-DEMO', createdAt: paidAt,
    });
  }
  await put(`users/${uid}`, profile);

  // A few coach sessions each
  for (let k = 0; k < 3; k++) {
    const [gameId, betId] = games[(n + k) % games.length];
    const bankroll = [100, 200, 500][(n + k) % 3];
    const unit = Math.floor(bankroll * 0.02);
    const rounds = Array.from({ length: 8 + ((n * 3 + k) % 9) }, (_, i) => ({ stake: unit, net: (i * 7 + n + k) % 3 === 0 ? -unit : (i + k) % 2 ? unit : -unit }));
    const net = rounds.reduce((a, r) => a + r.net, 0);
    const start = new Date(now - (k * 2 + (n % 3)) * DAY - 3600_000 * (n + 1));
    await put(`users/${uid}/sessions/demo${k}`, {
      gameId, betId, casino: casinos[(n + k) % casinos.length], bankroll, unit, stopWin: unit * 5, stopLoss: unit * 10, minutes: 15,
      rounds, net, endReason: ['time', 'stop-win', 'rounds', 'stop-loss'][(n + k) % 4], startedAt: start, endedAt: new Date(start.getTime() + 15 * 60_000),
    });
  }
  n++;
}

await put('Contact/demo1', { name: 'Sam', email: 'sam@example.com', number: '@sam', message: 'Does the coach work with Evolution live tables?', createdAt: now - 2 * 3600_000 });

console.log('Seeded. Log in with admin@tablewise.test / admin123 or demo@tablewise.test / demo1234');

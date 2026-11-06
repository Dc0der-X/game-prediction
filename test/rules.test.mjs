// Security tests for firestore.rules, run against the local Firestore emulator:
//   npx firebase emulators:exec --only firestore --project demo-tablewise "node --test test/rules.test.mjs"
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';

const PROJECT = 'demo-tablewise';
const HOST = '127.0.0.1';
const PORT = 8080;
let n = 0;

/** A Firestore client signed in as `uid` (or signed out when uid is null). */
function as(uid, email = uid ? `${uid}@x.y` : undefined) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake' }, `app${n++}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, PORT, uid ? { mockUserToken: { user_id: uid, email } } : undefined);
  return db;
}

/** Writes test data with rules switched off (emulator admin access). */
async function seed(path, data) {
  const res = await fetch(`http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { stringValue: String(v) }])) }),
  });
  assert.ok(res.ok, `seed ${path}: ${res.status}`);
}

const denied = (p) => assert.rejects(p, /permission|PERMISSION_DENIED/i);

before(async () => {
  await fetch(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await seed('User/old1', { email: 'boss@x.y', password: 'secret123', Role: 'Admin' });
  await seed('users/admin1', { role: 'admin', email: 'admin1@x.y', name: 'Admin' });
  await seed('users/bob', { role: 'customer', email: 'bob@x.y', name: 'Bob' });
  await seed('payments/p1', { uid: 'bob', amountUsd: '140' });
  await seed('checkouts/c1', { uid: 'bob' });
});

test('old plaintext-password collection is unreadable – signed out or in', async () => {
  await denied(getDocs(collection(as(null), 'User')));
  await denied(getDoc(doc(as('bob'), 'User/old1')));
});

test('new account can only be created as a customer', async () => {
  const db = as('alice');
  const base = { name: 'Alice', email: 'alice@x.y', phone: '', telegram: '', ageConfirmed: true, createdAt: serverTimestamp() };
  await denied(setDoc(doc(db, 'users/alice'), { ...base, role: 'admin' }));
  await denied(setDoc(doc(db, 'users/alice'), { ...base, role: 'customer', plan: 'pro' }));
  await denied(setDoc(doc(db, 'users/alice'), { ...base, role: 'customer', email: 'someone-else@x.y' }));
  await denied(setDoc(doc(db, 'users/alice'), { ...base, role: 'customer', name: 'x'.repeat(5000) }));
  await setDoc(doc(db, 'users/alice'), { ...base, role: 'customer' });
});

test('players cannot give themselves admin, Pro or paid time', async () => {
  const db = as('bob');
  await denied(updateDoc(doc(db, 'users/bob'), { role: 'admin' }));
  await denied(updateDoc(doc(db, 'users/bob'), { plan: 'pro', planExpiresAt: Timestamp.fromMillis(Date.now() + 9e11) }));
  await denied(updateDoc(doc(db, 'users/bob'), { planSource: 'crypto' }));
  await denied(updateDoc(doc(db, 'users/bob'), { trialOk: true }));
  await updateDoc(doc(db, 'users/bob'), { name: 'Bobby' });
});

test("players cannot read or change someone else's profile", async () => {
  await denied(getDoc(doc(as('bob'), 'users/admin1')));
  await denied(updateDoc(doc(as('bob'), 'users/alice'), { name: 'hacked' }));
  await denied(getDocs(collection(as('bob'), 'users')));
});

test('goal: valid goals save, silly ones are refused', async () => {
  const db = as('bob');
  await updateDoc(doc(db, 'users/bob'), { goal: { start: 200, target: 1000, setAt: Date.now() } });
  await denied(updateDoc(doc(db, 'users/bob'), { goal: { start: 200, target: 1e9, setAt: Date.now() } }));
  await denied(updateDoc(doc(db, 'users/bob'), { goal: { start: 200, target: 1000, setAt: Date.now(), role: 'admin' } }));
});

test('payments, checkouts and server data are private', async () => {
  await denied(getDoc(doc(as('bob'), 'payments/p1')));
  await denied(getDoc(doc(as('bob'), 'checkouts/c1')));
  await denied(setDoc(doc(as('bob'), 'payments/fake'), { uid: 'bob', amountUsd: 999 }));
  await denied(setDoc(doc(as('bob'), 'trialIps/x'), { uids: 'bob' }));
  await denied(getDoc(doc(as(null), 'botChats/x')));
});

test('admin can read players and grant passes, but not change roles', async () => {
  const db = as('admin1');
  await getDoc(doc(db, 'users/bob'));
  await getDoc(doc(db, 'payments/p1'));
  await updateDoc(doc(db, 'users/bob'), { plan: 'pro', planSource: 'admin', planExpiresAt: Timestamp.fromMillis(Date.now() + 86400000) });
  await denied(updateDoc(doc(db, 'users/bob'), { role: 'admin' }));
});

test('cash-outs feed: only fresh, positive entries from signed-in players', async () => {
  const good = { game: 'baccarat', net: 20, pct: 10, minutes: 30, endReason: 'stop-win', createdAt: Date.now() };
  await addDoc(collection(as('bob'), 'feed'), good);
  await denied(addDoc(collection(as(null), 'feed'), good));
  await denied(addDoc(collection(as('bob'), 'feed'), { ...good, net: -50, pct: -25 }));
  await denied(addDoc(collection(as('bob'), 'feed'), { ...good, pct: 5000 }));
  await denied(addDoc(collection(as('bob'), 'feed'), { ...good, createdAt: Date.now() - 86400000 }));
  await denied(addDoc(collection(as('bob'), 'feed'), { ...good, name: 'spam' }));
  await getDocs(collection(as(null), 'feed'));
});

test('sessions: own only, known fields only', async () => {
  const s = {
    gameId: 'baccarat', betId: 'banker', system: 'neural', casino: 'Live', bankroll: 200, unit: 1, stopWin: 20, stopLoss: 40,
    minutes: 45, rounds: [], net: 12, endReason: 'stop-win', startedAt: Timestamp.now(), endedAt: Timestamp.now(), savedAt: serverTimestamp(),
  };
  await addDoc(collection(as('bob'), 'users/bob/sessions'), s);
  await denied(addDoc(collection(as('bob'), 'users/alice/sessions'), s));
  await denied(addDoc(collection(as('bob'), 'users/bob/sessions'), { ...s, casino: 'x'.repeat(5000) }));
  await denied(addDoc(collection(as('bob'), 'users/bob/sessions'), { ...s, role: 'admin' }));
  await denied(getDocs(collection(as('bob'), 'users/alice/sessions')));
});

test('contact form accepts messages but nobody can read them except admin', async () => {
  await addDoc(collection(as(null), 'Contact'), { name: 'A', email: 'a@x.y', number: '', message: 'Hi', createdAt: Date.now() });
  await denied(getDocs(collection(as('bob'), 'Contact')));
  await denied(addDoc(collection(as(null), 'Contact'), { name: 'A', email: 'a@x.y', message: 'x'.repeat(5000), createdAt: Date.now() }));
});

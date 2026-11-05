/**
 * One-time migration from the old app.
 *
 * The old app kept users (including the admin) in the Firestore "User" collection
 * with plaintext passwords and logged in by downloading that whole collection.
 * This script moves every account to Firebase Authentication with the SAME
 * email and password, so your admin login keeps working exactly as before.
 *
 *   node migrate-legacy-users.mjs ./service-account.json            # dry run – shows what would happen
 *   node migrate-legacy-users.mjs ./service-account.json --apply    # do it
 *   node migrate-legacy-users.mjs ./service-account.json --apply --delete-legacy   # and remove the old plaintext records
 *   add --mask to hide most of each email in the output
 *
 * Get service-account.json from Firebase console → Project settings → Service accounts →
 * Generate new private key. Keep it private; it is git-ignored.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const [saPath, ...flags] = process.argv.slice(2);
if (!saPath) {
  console.error('Usage: node migrate-legacy-users.mjs <service-account.json> [--apply] [--delete-legacy]');
  process.exit(1);
}
const APPLY = flags.includes('--apply');
const DELETE_LEGACY = flags.includes('--delete-legacy');
// --mask hides most of each email in the output (for logs other people may see).
const MASK = flags.includes('--mask');
const show = (e) => (MASK ? String(e).replace(/^(.)[^@]*(@.*)$/, '$1***$2') : e);

initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) });
const auth = getAuth();
const db = getFirestore();

const legacy = await db.collection('User').get();
console.log(`Found ${legacy.size} legacy user(s). ${APPLY ? 'APPLYING' : 'DRY RUN'}\n`);

let created = 0, existing = 0, skipped = 0;
for (const d of legacy.docs) {
  const u = d.data();
  const email = String(u.email || '').trim().toLowerCase();
  const password = String(u.password || '');
  const role = u.Role === 'Admin' ? 'admin' : 'customer';
  if (!email) { console.log(`- skip ${d.id}: no email`); skipped++; continue; }

  let uid;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    existing++;
    console.log(`= ${show(email)} (${role}) already in Firebase Auth – keeping its current password`);
  } catch {
    if (password.length < 6) {
      console.log(`- skip ${show(email)}: password shorter than 6 characters (Firebase minimum). Ask them to sign up again.`);
      skipped++;
      continue;
    }
    console.log(`+ ${show(email)} (${role}) → create Firebase Auth user with the same password`);
    if (APPLY) uid = (await auth.createUser({ email, password, displayName: u.name || undefined })).uid;
    created++;
  }
  if (!APPLY || !uid) continue;

  const expiry = u.experie ? new Date(u.experie) : null;
  const profile = {
    name: u.name || '',
    email,
    phone: u.number ? String(u.number) : '',
    telegram: u.telegram || '',
    role,
    ageConfirmed: true,
    createdAt: Timestamp.now(),
  };
  // Keep any paid time the old admin had granted.
  if (role === 'customer' && expiry && expiry.getTime() > Date.now()) {
    Object.assign(profile, { plan: 'pro', planSource: 'admin', planExpiresAt: Timestamp.fromDate(expiry) });
  }
  await db.doc(`users/${uid}`).set(profile, { merge: true });
  if (DELETE_LEGACY) await d.ref.delete();
}

console.log(`\nDone. created=${created} existing=${existing} skipped=${skipped}`);
if (!APPLY) console.log('Nothing was written. Re-run with --apply.');
if (APPLY && !DELETE_LEGACY) console.log('Tip: re-run with --delete-legacy to remove the old plaintext passwords from Firestore.');
process.exit(0);

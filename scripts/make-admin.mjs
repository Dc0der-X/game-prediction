/**
 * Make an existing account an admin (sign up in the app first).
 *   node make-admin.mjs ./service-account.json you@example.com
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [saPath, email] = process.argv.slice(2);
if (!saPath || !email) {
  console.error('Usage: node make-admin.mjs <service-account.json> <email>');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) });
const user = await getAuth().getUserByEmail(email.trim().toLowerCase());
await getFirestore().doc(`users/${user.uid}`).set({ role: 'admin', email: user.email }, { merge: true });
console.log(`${user.email} is now an admin.`);
process.exit(0);

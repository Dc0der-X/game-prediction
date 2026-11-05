/**
 * Fills the public settings of the production build from environment variables,
 * so nothing has to be edited by hand (used by .github/workflows/deploy.yml).
 *
 *   PAYMENTS_API_URL   e.g. https://tablewise-payments.yourname.workers.dev
 *   SUPPORT_TELEGRAM   bot username without @, e.g. TableWiseHelpBot
 *   SUPPORT_WHATSAPP   digits only, e.g. 15551234567
 *
 * Empty or missing values leave the file unchanged.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/environments/environment.prod.ts', import.meta.url);
let src = readFileSync(file, 'utf8');

function set(key, value, valid) {
  const v = (value || '').trim();
  if (!v) return;
  if (!valid.test(v)) {
    console.error(`::error::${key} has an unexpected format: ${v}`);
    process.exit(1);
  }
  const re = new RegExp(`(\\b${key}: )'[^']*'`);
  if (!re.test(src)) {
    console.error(`::error::Could not find ${key} in environment.prod.ts`);
    process.exit(1);
  }
  src = src.replace(re, `$1'${v}'`);
  console.log(`${key} set`);
}

set('apiUrl', process.env.PAYMENTS_API_URL?.replace(/\/$/, ''), /^https:\/\/[a-z0-9.-]+(\/[\w.-]*)*$/i);
set('telegram', process.env.SUPPORT_TELEGRAM?.replace(/^@/, ''), /^[A-Za-z0-9_]{5,32}$/);
set('whatsapp', process.env.SUPPORT_WHATSAPP?.replace(/[^\d]/g, ''), /^\d{7,15}$/);
writeFileSync(file, src);

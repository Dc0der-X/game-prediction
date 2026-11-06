/**
 * Points the build at YOUR Firebase project and site, from GitHub Actions variables –
 * nothing has to be edited by hand (used by .github/workflows/deploy.yml).
 *
 *   FIREBASE_WEB_CONFIG  the "firebaseConfig" snippet from Firebase console → Project settings →
 *                        Your apps → Web app (paste it as is: { apiKey: "...", authDomain: "...", ... })
 *   SITE_URL             optional own domain, e.g. https://tablewise.app (default: https://<projectId>.web.app)
 *   PAYMENTS_API_URL     optional payment server URL (default: filled from the worker deploy)
 *   SUPPORT_TELEGRAM     optional bot username, e.g. TableWiseHelpBot
 *   SUPPORT_WHATSAPP     optional WhatsApp number, digits only
 *   TELEGRAM_OWNER_CHAT_ID  optional, for bot hand-off pings
 *   PAYGATE_WALLET       your EVM wallet for PayGate.to payouts (card payments arrive as USDC on Polygon)
 *   PAYGATE_BTC / PAYGATE_TRC20 / PAYGATE_SOLANA  optional extra wallets for the crypto checkout
 *
 * Writes: src/environments/environment.prod.ts, firebase.json, .firebaserc, payments-worker/wrangler.toml
 * and the site address in index.html / sitemap.xml / robots.txt / llms.txt / seo.service.ts.
 * Prints project_id, site_url and auth_domain to $GITHUB_OUTPUT when running in Actions.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const write = (p, s) => writeFileSync(new URL(p, root), s);
const fail = (msg) => {
  console.error(`::error::${msg}`);
  process.exit(1);
};
const env = (k) => (process.env[k] || '').trim();
const OLD_SITE = 'https://aicasinopredictor.web.app';

// ---------- Firebase web config ----------
const raw = env('FIREBASE_WEB_CONFIG');
const cfg = {};
for (const m of raw.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g)) cfg[m[1]] = m[2];
const allowed = {
  apiKey: /^AIza[\w-]{30,45}$/,
  authDomain: /^[a-z0-9.-]+$/,
  projectId: /^[a-z][a-z0-9-]{4,29}$/,
  storageBucket: /^[a-z0-9.-]+$/,
  messagingSenderId: /^\d{6,20}$/,
  appId: /^[\w:.-]+$/,
  measurementId: /^G-[A-Z0-9]+$/,
};
let projectId = '';
let authDomain = '';
if (raw) {
  for (const k of ['apiKey', 'authDomain', 'projectId', 'appId']) if (!cfg[k]) fail(`FIREBASE_WEB_CONFIG is missing "${k}". Paste the whole firebaseConfig snippet.`);
  for (const [k, v] of Object.entries(cfg)) if (allowed[k] && !allowed[k].test(v)) fail(`FIREBASE_WEB_CONFIG: "${k}" looks wrong.`);
  projectId = cfg.projectId;
  authDomain = cfg.authDomain;
  const block = ['  firebase: {', ...Object.keys(allowed).filter((k) => cfg[k]).map((k) => `    ${k}: '${cfg[k]}',`), '  },'].join('\n');
  let src = read('src/environments/environment.prod.ts');
  src = src.replace(/  firebase: \{[\s\S]*?\n  \},/, block);
  write('src/environments/environment.prod.ts', src);
  console.log(`Firebase project: ${projectId}`);
} else {
  projectId = (read('src/environments/environment.prod.ts').match(/projectId: '([^']+)'/) || [])[1] || '';
  authDomain = (read('src/environments/environment.prod.ts').match(/authDomain: '([^']+)'/) || [])[1] || '';
  console.log(`::warning::FIREBASE_WEB_CONFIG not set – using the project in environment.prod.ts (${projectId}).`);
}

// ---------- Site address ----------
let site = env('SITE_URL').replace(/\/$/, '');
if (site && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) fail('SITE_URL must look like https://yourdomain.com');
if (!site) site = `https://${projectId}.web.app`;
for (const f of ['src/index.html', 'src/sitemap.xml', 'src/robots.txt', 'src/llms.txt', 'src/app/core/seo.service.ts']) {
  const s = read(f);
  if (s.includes(OLD_SITE) && site !== OLD_SITE) write(f, s.split(OLD_SITE).join(site));
}
console.log(`Site: ${site}`);

// ---------- Firebase Hosting / CLI ----------
const fb = JSON.parse(read('firebase.json'));
delete fb.hosting.site; // deploy to the project's default site (<projectId>.web.app)
for (const h of fb.hosting.headers) {
  for (const x of h.headers) {
    if (x.key === 'Content-Security-Policy') {
      x.value = x.value.replace(/frame-src [^;]*/, `frame-src https://${authDomain} https://accounts.google.com https://apis.google.com`);
    }
  }
}
write('firebase.json', JSON.stringify(fb, null, 2) + '\n');
write('.firebaserc', JSON.stringify({ projects: { default: projectId } }, null, 2) + '\n');

// ---------- Public app settings ----------
let prod = read('src/environments/environment.prod.ts');
function set(key, value, valid) {
  if (!value) return;
  if (!valid.test(value)) fail(`${key} has an unexpected format: ${value}`);
  const re = new RegExp(`(\\b${key}: )'[^']*'`);
  if (!re.test(prod)) fail(`Could not find ${key} in environment.prod.ts`);
  prod = prod.replace(re, `$1'${value}'`);
  console.log(`${key} set`);
}
set('apiUrl', env('PAYMENTS_API_URL').replace(/\/$/, ''), /^https:\/\/[a-z0-9.-]+(\/[\w.-]*)*$/i);
set('telegram', env('SUPPORT_TELEGRAM').replace(/^@/, ''), /^[A-Za-z0-9_]{5,32}$/);
set('whatsapp', env('SUPPORT_WHATSAPP').replace(/[^\d]/g, ''), /^\d{7,15}$/);
write('src/environments/environment.prod.ts', prod);

// ---------- Payment server settings ----------
let toml = read('payments-worker/wrangler.toml');
const tomlSet = (k, v) => {
  const re = new RegExp(`^${k} = ".*"$`, 'm');
  if (!re.test(toml)) fail(`Could not find ${k} in wrangler.toml`);
  toml = toml.replace(re, `${k} = "${v}"`);
};
const origins = [...new Set([site, `https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`])].join(',');
tomlSet('FIREBASE_PROJECT_ID', projectId);
tomlSet('APP_URL', site);
tomlSet('APP_ORIGINS', origins);
const owner = env('TELEGRAM_OWNER_CHAT_ID');
if (owner) {
  if (!/^-?\d{4,20}$/.test(owner)) fail('TELEGRAM_OWNER_CHAT_ID must be a number');
  tomlSet('TELEGRAM_OWNER_CHAT_ID', owner);
}
const wallets = {
  PAYGATE_WALLET: /^0x[a-fA-F0-9]{40}$/,
  PAYGATE_BTC: /^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  PAYGATE_TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  PAYGATE_SOLANA: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};
for (const [k, re] of Object.entries(wallets)) {
  const v = env(k);
  if (!v) continue;
  if (!re.test(v)) fail(`${k} doesn't look like a valid wallet address.`);
  tomlSet(k, v);
  console.log(`${k} set`);
}
write('payments-worker/wrangler.toml', toml);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `project_id=${projectId}\nsite_url=${site}\nauth_domain=${authDomain}\n`);
}

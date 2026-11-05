# ♠ TableWise

**Practice casino tables free. Play real money with a coach that tells you what to bet, how much, and when to stop.**

TableWise replaces the old "AI Casino Predictor". Casino results are random and every bet has a house edge,
so the app no longer claims to predict anything. Instead it sells something it can actually deliver:
fun, unlimited practice and a disciplined way to play for real that keeps losses small.

---

## What users get

| | Free | Pro pass |
|---|---|---|
| Practice tables (Baccarat, Craps, Roulette, Sic Bo, Dragon Tiger) with play money and signals | ✅ forever | ✅ |
| **Signal Room**: enter your amount, tap what came, get the side and the amount for every bet | first 3 hours | ✅ |
| Live target, safety limit, cash-out and fresh-table alerts, floating signal window | first 3 hours | ✅ |
| History and the **winnings wall** | first 3 hours | ✅ |
| **My Goal** – compounding calculator: start → goal, session-by-session plan, real progress, today's step | first 3 hours | ✅ |
| Personal colour themes, pause option, 24/7 Telegram support bot | ✅ | ✅ |

### Pricing

| Pass | Price | Per day |
|---|---|---|
| Free trial | 3 hours after sign-up, no card | – |
| Day Pass | **$20** | $20.00 |
| Monthly | **$140** (30 days) | $4.67 (save 77%) |
| Yearly | **$999** (365 days) | $2.74 (save 86%) |

Passes are one-time payments (card or crypto through one hosted checkout). They switch on the moment the buyer is back
from checkout, never auto-renew and stack on any time left.
Change prices in `src/app/core/pricing.ts` **and** `payments-worker/wrangler.toml` (`PRICE_DAY_USD`, `PRICE_MONTH_USD`,
`PRICE_YEAR_USD`).

Games: Baccarat, Craps, Roulette, Sic Bo, Dragon Tiger (even-money sides: Player/Banker, Pass/Don't Pass, Red/Black,
Small/Big, Dragon/Tiger).

### Design and marketing

- **Personal themes:** visitors pick a colour mood that feels like theirs. Neon (calm focus), High Roller (gold and
  plum, status), Classic (green felt, comfort) and Ember (bold energy). The choice is remembered on their device.
- **Personal touches:** a greeting by name and time of day, celebration on cash-out, and a winnings wall in History.
- **Real social proof:** the home page "Live results" feed and the "% of sessions hit their target" figure come from
  real anonymous session results (collection `feed`: game, result %, minutes; no names or bets). Nothing is made up.
- **Pricing psychology:** each plan shows its per-day price next to the $20 Day Pass, so longer passes read as clear
  value. "Best value" is mathematically true.
- **The method stays private:** public pages and the setup screen describe what the coach does, not how it works.

### SEO and AI search

- Per-page titles, descriptions, canonical URLs and robots rules (`src/app/core/seo.service.ts` plus route `data`).
- Open Graph and Twitter cards with `src/assets/og-image.png` (1200×630).
- JSON-LD structured data in `src/index.html`: Organization, WebSite, SoftwareApplication with all four offers, and
  an FAQPage.
- `robots.txt`, `sitemap.xml`, **`llms.txt`** (a plain-text summary for ChatGPT, Perplexity, Claude and similar
  crawlers) and `manifest.webmanifest`, so the site can be installed on a phone.
- `<noscript>` content, so crawlers that don't run JavaScript still read what the product is.
- When you move to your own domain, replace `https://aicasinopredictor.web.app` in `src/index.html`,
  `src/app/core/seo.service.ts`, `src/robots.txt`, `src/sitemap.xml` and `src/llms.txt`.

### Neural Signals (one system for everyone)

Every player gets the same signals; there is no strategy to pick and nothing to read.

1. **Side – SOS rule (Same, Opposite, Same).** Start on the side that came last. A win keeps the pattern that just
   won. 1st miss → follow the side that just came (Same); 2nd miss → bet against it (Opposite – the table is
   swinging); 3rd miss → Same again. Result: **the signal never bets against a run** – once a side comes twice in a
   row, the signal is on it (checked on 18.9 million simulated bets, 0 exceptions). Zero / tie / bar don't change the side.
2. **Amount – 8-step ladder, always exactly 1.5 · 2.5 · 4 · 6 · 10.5 · 15 · 22.5 · 30 chips.** The chip is picked
   from the amount: $1 up to $919 (bets 1.5 · 2.5 · 4 · 6 · 10.5 · 15 · 22.5 · 30), $5 from $920 (7.5 · 12.5 · 20 · 30 ·
   52.5 · 75 · 112.5 · 150), then $10, $25, $50, $100. Up one step after a miss; down one after a win, down two after
   two wins in a row or two of the last three. Every signal shows the change from the last bet (▲ +1 / ▼ −1.5 / = same).
3. **Session rules (same for every game):** profit target **+10%** of the amount → cash out; once well up (60% of the
   target), 2 misses in a row → cash out on top; **3 misses in a row → fresh table** (ladder back to step 1, totals
   carry on); **safety limit 20%** of the amount – no bet can go past it. Check-in every 15 minutes, one session a day.

Target and limit were chosen by simulation (8,000 sessions per game per setting, $200, $1 chip, 45 minutes):
+10% / 20% gave the highest share of winning sessions on every game – Baccarat 55%, Craps 55%, Dragon Tiger 53%,
Sic Bo 51%, Roulette 49% – with the smallest average cost (about −$1 to −$4 per $200 session). Averages stay
slightly negative, as with any system on a house-edge game. Code: `NeuralSystem` in `src/app/core/strategies.ts`, `SignalEngine` in
`src/app/core/signals.ts`.

---

## Free stack

| Piece | Service | Free tier |
|---|---|---|
| Hosting | Firebase Hosting | 10 GB storage, 360 MB/day transfer |
| Login | Firebase Authentication (email + password) | 50,000 monthly active users |
| Database | Cloud Firestore | 1 GB, 50k reads / 20k writes per day |
| Payment verification | Cloudflare Workers (`payments-worker/`) | 100,000 requests/day |
| Admin dashboard | Built into the app at `/admin` | – |

All of this runs on the **free Firebase Spark plan**. No Cloud Functions are needed, so you never have to add a card
to Firebase. Payment fees are charged only by the checkout provider, per transaction; the support bot costs about
a cent per reply in Claude API usage.

Everything is open source: Angular, Ionic, Firebase JS SDK, `jose`, `wrangler`.

---

## Go live (no terminal needed)

Deploys run from GitHub Actions (`.github/workflows/deploy.yml`): every push to `main` publishes the website, the
login, the database rules, the payment server and the support bot. Each part switches on as soon as its secrets exist.

**Step 1 – Firebase login (5 minutes, console.firebase.google.com → project `prediction-ai-a4dfe`)**
1. *Authentication → Get started → Sign-in method*: enable **Email/Password** and **Google**.
2. *Authentication → Settings → Authorized domains*: add `aicasinopredictor.web.app`.
3. *Project settings → Service accounts → Generate new private key* – downloads a JSON file.
4. console.cloud.google.com → *IAM* → the `firebase-adminsdk-…` account → *Edit* → add the role **Firebase Admin**.

**Step 2 – GitHub secret.** Repo → *Settings → Secrets and variables → Actions → New repository secret*:
`FIREBASE_SERVICE_ACCOUNT` = the whole JSON file from step 1.3.

**Step 3 – Publish.** Merge this branch into `main` (or *Actions → Deploy → Run workflow*). When it's green the app is
live at https://aicasinopredictor.web.app with email and Google login.

**Step 4 – Keep your admin login (do this right after step 3).** *Actions → Move old accounts → Run workflow*:
`preview`, then `apply`. Every old account (yours included) logs in with the same email and password. Run
`apply-and-clean` last to delete the old plaintext passwords. Then **change your admin password** (Account → Forgot
password) – the old app exposed it publicly. Security details and the full owner checklist: [SECURITY.md](SECURITY.md).

**Then, whenever you're ready – payments and the 24/7 bot** (add the secrets, then *Actions → Deploy → Run workflow*):

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | dash.cloudflare.com (free) → *My Profile → API Tokens → "Edit Cloudflare Workers"*; account id on the Workers page |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | nowpayments.io → *Settings → Payments* |
| `IP_SALT` | any long random string |
| `TELEGRAM_BOT_TOKEN` | Telegram → @BotFather → `/newbot` |
| `TELEGRAM_WEBHOOK_SECRET` | any random string (letters/numbers) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

Optional *variables* (same page, Variables tab): `SUPPORT_TELEGRAM` (bot username), `SUPPORT_WHATSAPP` (digits),
`TELEGRAM_OWNER_CHAT_ID` (your chat id for hand-offs), `PAYMENTS_API_URL` (filled automatically when empty).
The workflow sets the worker's secrets, connects the Telegram bot and points the app at the payment server by itself.

## Setup

### 1. Firebase (once)

1. In the [Firebase console](https://console.firebase.google.com) open project `prediction-ai-a4dfe`.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database** (production mode) if it doesn't exist.
4. Deploy rules, indexes and the site:
   ```bash
   npm install
   npx firebase login
   npm run deploy
   ```

### 1b. Google sign-in, support chat and the free-trial limit

1. Firebase console → Authentication → Sign-in method → **Google → Enable**. Add your domain under
   Authentication → Settings → **Authorized domains**.
2. Put your Telegram username and WhatsApp number in `src/environments/environment.prod.ts` → `support`.
   The floating **Help** button opens them with the user's account email pre-filled.
3. Free trial limit: the payment worker gives the 3 free hours to at most **2 accounts per network**
   (`TRIAL_PER_IP` in `wrangler.toml`). It stores only a salted one-way hash of the IP. Set the salt once:
   `npx wrangler secret put IP_SALT` (any long random string). Without the worker (local/demo) everyone gets the trial.

### 2. Keep your admin login (migrate old accounts)

The old app stored every account, including the admin, in the `User` collection **with plaintext passwords**, and
logged in by downloading the whole collection to the browser. Anyone could read every password. The new rules lock
that collection.

The migration script moves every old account to Firebase Authentication **with the same email and password**, so your
admin credentials keep working. Customers' remaining paid time is kept.

1. Firebase console → Project settings → Service accounts → **Generate new private key** → save it as
   `scripts/service-account.json` (git-ignored, never commit it).
2. Run:
   ```bash
   cd scripts && npm install
   node migrate-legacy-users.mjs ./service-account.json            # dry run, shows what will happen
   node migrate-legacy-users.mjs ./service-account.json --apply
   node migrate-legacy-users.mjs ./service-account.json --apply --delete-legacy   # remove old plaintext passwords
   ```
3. Log in at `/login` with your usual admin email and password. The **Admin** badge links to `/admin`.

To make another account an admin later: `node make-admin.mjs ./service-account.json someone@example.com`.

### 3. Payments (free Cloudflare Worker)

```bash
cd payments-worker
npm install
npx wrangler login
```

**Card + crypto** (nowpayments.io – one hosted checkout; enable card payments in your NOWPayments dashboard if your
account supports them, or swap in another card-to-crypto gateway with the same invoice + signed-webhook flow):
1. Create an account and add your payout wallet.
2. Copy the **API key** and set an **IPN secret**.

Then:
1. Fill in `APP_URL` (and `HOLD_MINUTES`, default 60) in `payments-worker/wrangler.toml`.
2. Set the secrets:
   ```bash
   npx wrangler secret put NOWPAYMENTS_API_KEY
   npx wrangler secret put NOWPAYMENTS_IPN_SECRET
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT   # paste the service-account JSON
   npx wrangler secret put IP_SALT                  # any long random string
   npm test && npm run deploy
   ```
3. Put the worker URL in `src/environments/environment.prod.ts` → `payments.apiUrl`, then `npm run deploy` again
   from the project root.

**Instant access, automatic hold – no manual approval ever:**
1. Buyer picks a pass → hosted checkout → pays → lands on `/pro?paid=<ref>`. The pass switches on **right away**
   (status "pending") and the buyer goes straight to the Signal Room.
2. Payment seen on the network → the pending time is extended. Payment finished → the full Day / Month / Year pass
   is granted, counted from the moment it switched on.
3. Payment failed / expired, or no confirmation within 60 minutes → the pass pauses by itself ("payment not received").
   If the payment arrives later, it switches back on automatically.
4. Only one unconfirmed instant start per account, so the free hour can't be farmed with fake checkouts.

How it stays safe: the browser only starts a checkout. Only the provider's signed IPN (signature, amount and
duplicate checks) grants a full pass, written with the service account. Firestore rules stop customers from ever
writing their own plan, role or expiry date.

### 4. 24/7 Telegram support bot (fully automatic)

The worker also runs a Telegram bot (`payments-worker/src/bot.ts`) that answers customers in a warm, upbeat voice
using Claude: how it works, games, prices, how to pay, pass status. It never promises wins, never asks for card
details, is honest if someone sincerely asks whether it's a bot, and pings you only when a customer asks for a person.

1. In Telegram, message **@BotFather** → `/newbot` → copy the token. Put the bot's username in
   `src/environments/environment.prod.ts` → `support.telegram`.
2. Set the secrets and deploy:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # any random string
   npx wrangler secret put ANTHROPIC_API_KEY         # console.anthropic.com
   npm run deploy
   ```
3. Connect Telegram to the worker once (in a browser):
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/telegram/webhook&secret_token=<SECRET>`
4. Optional: put your own Telegram chat id in `TELEGRAM_OWNER_CHAT_ID` (wrangler.toml) to get a ping for hand-offs.

The bot uses `claude-opus-5-5` at low effort (change with the `BOT_MODEL` var). Only the last 10 messages of each chat
are kept, under a hashed chat id. WhatsApp: keep it as a click-to-chat link plus WhatsApp Business auto-replies;
WhatsApp's business rules restrict gambling-related messaging, so Telegram carries the automation.

---

## Admin dashboard (`/admin`)

- Registered users (today / 7 days / 30 days), trials, paying users, trial → paid conversion
- Revenue (30 days and all time) and estimated monthly recurring revenue
- Sign-ups per day chart
- User list with search, CSV export and **+30 days / +1 year / Revoke** buttons (for manual payments)
- Every card / crypto payment
- Live feed of coach sessions (game, casino, budget, result)
- Contact-form messages

For raw data you can also use the Firebase console (Authentication and Firestore tabs).

---

## Local development

```bash
npm install
npm run emulators          # terminal 1: local Auth + Firestore (needs Java)
npm run seed:emulators     # terminal 2 (once): demo admin, demo player, sample customers and payments
npm run start:emulators    # terminal 2: app on http://localhost:4200 using the emulators
```

Demo logins (local emulators only): `admin@tablewise.test` / `admin123` and `demo@tablewise.test` / `demo1234`.
The dev server proxies the emulators on the app's own address, so it also works from a phone on your network.

`npm start` runs against the real Firebase project.

## Project map

```
src/app/core/        games.ts (engines + odds), strategies.ts (rules, coach plan, simulator),
                     account / sessions / payments services, guards, pricing
src/app/pages/       lobby, table, rules, auth, coach, history, pro, account, admin
src/app/home/        public landing page
firestore.rules      security rules (who can read and write what)
payments-worker/     Cloudflare Worker: checkout, instant pass + auto-hold, trial limit, Telegram bot (+ tests)
scripts/             one-time migration and make-admin scripts
```

## Responsible play

18+. TableWise does not take bets, hold money or predict results. Help:
[BeGambleAware](https://www.begambleaware.org) · [GamCare](https://www.gamcare.org.uk) ·
[1-800-GAMBLER](https://www.ncpgambling.org/help-treatment/) · [Gamblers Anonymous](https://www.gamblersanonymous.org)

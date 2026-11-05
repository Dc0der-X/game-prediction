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
| Live target and loss tracking, check-ins, STOP and cash-out signs | first 3 hours | ✅ |
| History and the **winnings wall** | first 3 hours | ✅ |
| Strategy Lab | first 3 hours | ✅ |
| Personal colour themes, self-exclusion | ✅ | ✅ |

### Pricing

| Pass | Price | Per day |
|---|---|---|
| Free trial | 3 hours after sign-up, no card | – |
| Day Pass | **$20** | $20.00 |
| Monthly | **$140** (30 days) | $4.67 (save 77%) |
| Yearly | **$999** (365 days) | $2.74 (save 86%) |

Passes are one-time payments (PayPal, card or crypto). They never auto-renew and stack on any time left.
Change prices in `src/app/core/pricing.ts` **and** `payments-worker/wrangler.toml` (`PRICE_DAY_USD`, `PRICE_MONTH_USD`,
`PRICE_YEAR_USD`).

Games: only the five with the fairest even-money bets, ranked by house edge – Baccarat Banker 1.06%, Craps Don't Pass
1.36%, Roulette (single zero) 2.70%, Sic Bo Small/Big 2.78%, Dragon Tiger 3.73%. Lucky 7 (7.69%) was removed. Craps
follows the book's own rule: start on Don't Pass, switch to Pass after a level-5 loss.

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

### The Neural Strategy (the method behind the coach)

The Signal Room implements the betting method from *The Neural Strategy*, checked bet by bet against the
book's worked examples (Tables 2, 5 and 10):

1. **Watch two results.** Same twice → bet it to repeat. Different → bet the alternation; once an alternating bet
   loses, bet only the opposite of the losing bet.
2. **Bet ladder** (multiples of the base): 1 · 1.6 · 2.6 · 4 · 7 · 10 · 15 · 20, i.e. 5 8 13 20 35 50 75 100 for a 5 base.
   Up one level after a loss, down one after a win, down two after two wins in a row or two of the last three.
3. **Switch sides** when the level-5 bet loses. Bet the other side at level 6, with the book's step-down rules
   (−2, −1, −2… after wins) until three wins.
4. **Session:** the amount you enter is the session bankroll (base = amount ÷ 61). Quit at **+⅓**. The session ends
   if the bankroll is lost. A game that's still choppy after about 60 results is better called off.
5. **Protected mode** (optional): target +⅙, stop at half the amount.

Simulated over 72,000 fair sessions ($300, $5 base): Baccarat wins about 70% of sessions (+$100) and loses about 30%
(around −$273), for an average of about −$11 per session. The Protected settings average about −$5. These figures are
lower than the 84% the book reports. Code: `NeuralSystem` in `src/app/core/strategies.ts`, `SignalEngine` in
`src/app/core/signals.ts`.

**Why flat and not the old "recovery ladder"** (4-6-10-16-26-40-60): simulated on Baccarat Banker, $200 budget,
$4 stake, 20 rounds, 9,000+ sessions:

| System | Winning sessions | Real cost / session | Worst 1-in-10 session |
|---|---|---|---|
| **Flat + stops** | 47% | **−$0.80** | **−$21** |
| Recovery ladder | 67% | −$1.08 | −$55 |
| Martingale | 68% | −$0.96 | −$56 |

Recovery systems win more often but stake more, so they cost more and have much worse bad days.

**The original app's rule** is available in practice tables and the Strategy Lab as
*Original S/O + Attack/Retrench*. It's ported line by line from the old prediction pages:
- **Side (S/O):** keep the winning pattern; follow the last result after the 1st loss and switch after the 2nd.
- **Stake:** Attack 4-2-3-4-5-6-8-10 after wins, Retrench 4-6-10-16-26-40-60 after losses.

Averaged over 54,000 sessions each ($200, $4 base, +$20 / −$40 stops, 20 rounds):

| Game | System | Winning sessions | Real cost / session | Worst 1-in-10 |
|---|---|---|---|---|
| Roulette | Flat | 39% | −$1.94 | −$24 |
| Roulette | Original S/O | 65% | −$2.59 | −$54 |
| Baccarat | Flat | 48% | −$0.80 | −$21 |
| Baccarat | Original S/O | 68% | −$1.07 | −$54 | Every game engine
was checked over 1,000,000 rounds per game, and each bet's measured edge matches its published house edge.

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
to Firebase. Payment fees are charged only by PayPal / NOWPayments, per transaction.

Everything is open source: Angular, Ionic, Firebase JS SDK, `jose`, `wrangler`.

---

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

**PayPal** (developer.paypal.com):
1. Create a REST app. Copy its **Client ID** and **Secret**.
2. Add a **Webhook** pointing to `https://<your-worker>.workers.dev/paypal/webhook` with the event
   `PAYMENT.CAPTURE.COMPLETED`. Copy the webhook id. Passes are one-time orders, so no billing plan is needed.

**Crypto** (nowpayments.io):
1. Create an account and add your payout wallet.
2. Copy the **API key** and set an **IPN secret**.

Then:
1. Fill in `PAYPAL_CLIENT_ID`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV` (`sandbox` → `live`) and `APP_URL` in
   `payments-worker/wrangler.toml`.
2. Set the secrets:
   ```bash
   npx wrangler secret put PAYPAL_SECRET
   npx wrangler secret put NOWPAYMENTS_API_KEY
   npx wrangler secret put NOWPAYMENTS_IPN_SECRET
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT   # paste the service-account JSON
   npm test && npm run deploy
   ```
3. Put the worker URL and PayPal client id in `src/environments/environment.prod.ts` → `payments`, then
   `npm run deploy` again from the project root.

How it stays safe: the browser only starts a checkout. The worker checks every payment directly with PayPal or
NOWPayments (signature check, amount check, duplicate check), then writes `planExpiresAt` with the service account.
Firestore rules stop customers from ever writing their own plan, role or expiry date.

---

## Admin dashboard (`/admin`)

- Registered users (today / 7 days / 30 days), trials, paying users, trial → paid conversion
- Revenue (30 days and all time) and estimated monthly recurring revenue
- Sign-ups per day chart
- User list with search, CSV export and **+30 days / +1 year / Revoke** buttons (for manual payments)
- Every PayPal / crypto payment
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
src/app/pages/       lobby, table, rules, auth, coach, history, lab, pro, account, admin
src/app/home/        public landing page
firestore.rules      security rules (who can read and write what)
payments-worker/     Cloudflare Worker: PayPal + NOWPayments verification (+ tests)
scripts/             one-time migration and make-admin scripts
```

## Responsible play

18+. TableWise does not take bets, hold money or predict results. Help:
[BeGambleAware](https://www.begambleaware.org) · [GamCare](https://www.gamcare.org.uk) ·
[1-800-GAMBLER](https://www.ncpgambling.org/help-treatment/) · [Gamblers Anonymous](https://www.gamblersanonymous.org)

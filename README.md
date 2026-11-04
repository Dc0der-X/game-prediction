# ♠ TableWise

**Practice casino tables free. Play real money with a coach that tells you what to bet, how much, and when to stop.**

TableWise replaces the old "AI Casino Predictor". Casino results are random and every bet has a house edge,
so the app no longer claims to predict anything. Instead it sells something it can actually deliver:
fun, unlimited practice and a disciplined way to play for real that keeps losses small.

---

## What users get

| | Free | Pro (7-day free trial, then paid) |
|---|---|---|
| 5 practice tables (Baccarat, Roulette, Dragon Tiger, Sic Bo, Lucky 7) with play money | ✅ unlimited | ✅ |
| Strategy tester on every table | ✅ | ✅ |
| **Session Coach**: enter today's budget → "Bet 4 on Banker", stop-win, stop-loss, 10–20 min timer, one session a day | – | ✅ |
| Works with any online casino (casino recorded per session) | – | ✅ |
| History with honest running total, per-casino breakdown | – | ✅ |
| Strategy Lab: run any betting system on 9,000 simulated sessions | – | ✅ |
| Self-exclusion lock (24h – 6 months, can't be shortened) | ✅ | ✅ |

### The funnel (how it makes money)

1. **Hook**: anyone can open `/lobby` and play practice tables with no sign-up.
2. **Nudge**: after 10 practice rounds a card offers the free Pro trial.
3. **Trial**: sign-up gives 7 days of Pro with no card.
4. **Habit**: the coach is used daily (one session per day), and history builds up.
5. **Paywall**: when the trial ends, `/coach`, `/lab` and `/history` redirect to `/pro`.
6. **Pay**: PayPal subscription ($12/month, auto-renews) or crypto (1 month $12 / 12 months $99).

Prices live in `src/app/core/pricing.ts` and `payments-worker/wrangler.toml`. Keep them in sync with your PayPal plan.

### TableWise Signals + STOP rules (the method behind the coach)

The coach and the practice tables both run **TableWise Signals**, the original app's rule:
- **Side:** Same/Opposite pattern. Keep the winning pattern; follow the last result after the 1st loss and switch
  after the 2nd.
- **Stake:** Attack 4-2-3-4-5-6-8-10 after wins, Retrench 4-6-10-16-26-40-60 after losses (in units of base/4).

Every round shows one instruction, e.g. **"Bet 6 on Red"**. The rules around it:
1. Base stake = 2% of today's budget.
2. **STOP when up** at +10% and **STOP when down** at −20%. Bets are capped so no session can go past the loss
   limit, even in Retrench.
3. 10–20 minute timer, plus a **"STOP PLAYING NOW?" check-in every 5 minutes** (`SESSION_LIMITS.checkinMinutes`).
4. Hitting a limit or the timer shows the full-screen **STOP PLAYING NOW** sign and ends the session.
5. One real-money session per day. Flat staking is still offered as the lowest-cost option.

Code: `src/app/core/signals.ts` (engine), `src/app/core/strategies.ts` (`OriginalSystem`, `SESSION_LIMITS`),
`src/app/shared/stop-sign.component.ts`.

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
2. Create a Product and a monthly **Billing Plan** at your price. Copy the plan id (`P-…`).
3. Add a **Webhook** pointing to `https://<your-worker>.workers.dev/paypal/webhook` with events
   `BILLING.SUBSCRIPTION.*` and `PAYMENT.SALE.COMPLETED`. Copy the webhook id.

**Crypto** (nowpayments.io):
1. Create an account and add your payout wallet.
2. Copy the **API key** and set an **IPN secret**.

Then:
1. Fill in `PAYPAL_CLIENT_ID`, `PAYPAL_PLAN_ID`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV` (`sandbox` → `live`) and
   `APP_URL` in `payments-worker/wrangler.toml`.
2. Set the secrets:
   ```bash
   npx wrangler secret put PAYPAL_SECRET
   npx wrangler secret put NOWPAYMENTS_API_KEY
   npx wrangler secret put NOWPAYMENTS_IPN_SECRET
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT   # paste the service-account JSON
   npm test && npm run deploy
   ```
3. Put the worker URL, PayPal client id and plan id in `src/environments/environment.prod.ts` → `payments`, then
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

# Security

Review date: 2026-11-05. Everything below is covered by automated tests that run before every deploy.

## How the app is protected

| Area | Protection | Test |
|---|---|---|
| Accounts | Firebase Authentication (email + Google). Passwords are never stored by the app. | – |
| Roles | Nobody can make themselves admin: profiles are created as `customer` only; the role field can't be changed from the app, not even by an admin. | `test/rules.test.mjs` |
| Paid access | Plans, expiry dates and trial flags are written only by the payment server (service account). Players can't give themselves Pro. | rules tests |
| Payments | Full passes are granted only from PayGate.to's RSA-signed callback (signature over the exact URL, fail closed), plus the checkout's own secret token, the receiving address and the amount actually received; repeats are ignored. Money goes straight to the owner's wallet. | worker tests 1–11, 25 |
| Instant passes | Switch on only when the payment is seen on the network, or once per network per day; unpaid passes pause by themselves after 60 minutes. | worker tests 12–15 |
| Abuse limits | 10 checkouts per account per hour; free hours for 2 accounts per network; bot: 20 replies per chat per 10 minutes, 150 per day. | worker tests 16, 19–20, 24 |
| Privacy | IP addresses are stored only as salted one-way hashes; bot chats under a hashed chat id, last 10 messages only. | worker tests 9, 14, 16 |
| Data | Every collection has explicit rules: field lists, types and size limits; server-only collections are closed to the app. | rules tests |
| Old app data | On any project these rules run on, the old `User` collection (plaintext passwords) is unreadable. | rules test 1 |
| Migration | Accounts that already exist never inherit admin rights or paid time from the old app (prevents someone pre-registering the admin's email). | – |
| Browser | Content-Security-Policy (no inline scripts, no third-party scripts except Google sign-in), HSTS, no framing, nosniff, strict referrer, locked-down browser permissions. No source maps published. | `csptest` (manual) |
| Bot | Telegram webhook secret checked in constant time; the bot has no tools or data access, never asks for card details, and doesn't promise wins. | worker tests 13–15 |
| Secrets | Kept only in GitHub Actions secrets and Cloudflare; never in the code. The Firebase web `apiKey` in `environment*.ts` is public by design. | git history scanned |

## Known, accepted risks

- **Angular 16** has published advisories (XSS through untrusted SVG attributes / i18n, XSRF token leak with
  `HttpClient`). The app doesn't put untrusted data into SVG attributes, doesn't use i18n or `HttpClient` XSRF, and
  the Content-Security-Policy blocks injected scripts. Plan: upgrade Angular and Ionic in a later release.
- **Build tools** (`firebase-tools`, `wrangler`) have advisories in their own dependencies. They run only on GitHub's
  build servers; none of that code is shipped to visitors or to the payment server.
- **VPNs / mobile networks** can get around per-network limits (free hours, instant passes). Each account still needs
  its own email, and every instant pass pauses after 60 minutes without payment.
- **Email sign-ups aren't verified.** Someone can register with an address they don't own; the real owner can always
  take it back with "Forgot password". Admin rights are never granted through sign-up.

## Owner checklist (once)

1. Deploy to your own Firebase project, sign up, then *Actions → Make admin*.
2. The old site (`aicasinopredictor.web.app`, old Firebase project) exposes every old account's plaintext password and
   can only be fixed by that project's owner. Don't reuse any password from it, and ask the owner or Firebase support
   to take it down.
3. Google Cloud console → *APIs & Services → Credentials* → the Browser API key → restrict it to
   `<your-project-id>.web.app/*`, `<your-project-id>.firebaseapp.com/*` (and your own domain later).
4. Use a separate key with only *Cloud Datastore User* for the payment server (`WORKER_SERVICE_ACCOUNT` secret).
5. Turn on 2-step verification for the Google, GitHub and Cloudflare accounts, and keep the payout wallet's
   recovery phrase offline – whoever has it has the money.
6. Never paste keys into chat or commit them; put them in GitHub → Settings → Secrets.

## Reporting

Found a problem? Email the address on the Contact page. Please don't test against real players' accounts.

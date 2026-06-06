# Pi Runner

A one-thumb lane-dodge arcade game that runs inside the **Pi Browser**, with **Login with Pi**
and an optional **1 π** unlock (Gold Orb + a shield each run). The game is fully playable for
free — the payment is optional, which is what lets the MVP work in sandbox before Mainnet
payment approval.

```
pi-runner/
├─ public/
│  ├─ index.html      # loads the Pi SDK + the game shell
│  ├─ style.css       # neon-arcade UI, mobile-first portrait
│  └─ app.js          # Pi auth + payment layer, and the canvas game
├─ server.js          # Express: serves the app + 3 Pi server routes
├─ package.json
└─ .env.example
```

## What works without any setup
Open `index.html` (or run the server) in a **normal desktop/mobile browser** and the game is
fully playable. The Login and Unlock buttons detect that `window.Pi` is absent and show a
"open in the Pi Browser" message instead of erroring. This is intentional — it lets you test
the gameplay anywhere.

## 1. Register the app and get your API key
1. Open the **Pi Browser** on your phone.
2. Go to `pi://develop.pinet.com` (the Pi Developer Portal).
3. Register a new app (or select an existing one). Set the app's URL to your deployed URL
   (see step 3 below), and enable **Sandbox** for development.
4. Copy the app's **API key**.

## 2. Run locally
```bash
npm install
cp .env.example .env        # then edit .env and paste your key
# .env should contain:  PI_API_KEY=your_key_here
npm start                   # serves http://localhost:3000
```
> Auth and payments only function inside the Pi Browser. Locally you can verify the server
> boots, serves the page, and that the game plays. To exercise Pi login/payment you need to
> open the **deployed** URL inside the Pi Browser sandbox.

## 3. Deploy (pick one free option)
The app is a single Node/Express server that also serves the static frontend, so any Node host works.

- **Render / Railway:** new Web Service from this repo, build `npm install`, start `npm start`,
  add env var `PI_API_KEY`.
- **Replit:** import the repo, add `PI_API_KEY` to Secrets, run.
- **Vercel:** works too, but Vercel prefers serverless functions — the simplest path is a Node
  host (Render/Railway/Replit). If you use Vercel, move `/api/*` handlers into `/api` serverless
  functions and serve `/public` as static. (Manus can do this conversion for deployment.)

After deploying, put the live URL back into the Developer Portal app settings (step 1.3).

## 4. Test inside the Pi Browser
1. Open your deployed URL in the **Pi Browser** (sandbox).
2. Tap **Login with Pi** → approve the consent dialog → you should see `@yourusername`.
3. Play: tap/swipe left–right to switch lanes, collect **π** tokens, dodge red blocks.
4. Tap **Unlock Gold Orb + Shield · 1 π** → the Pi Wallet modal appears → approve.
   The server approves and completes the payment, and the unlock is granted.

## 5. Going to Mainnet payments
Sandbox uses test π. To accept **real** π, request Mainnet payment access in the Developer
Portal. Pi grants this to apps that show real utility, safe behavior, and stable operation.
Once approved, set `sandbox: false` in `app.js` (`Pi.init`).

## How the Pi pieces fit (reference)
- **SDK load:** `<script src="https://sdk.minepi.com/pi-sdk.js"></script>` then
  `Pi.init({ version: "2.0", sandbox: true })`.
- **Auth:** `Pi.authenticate(['username','payments'], onIncompletePaymentFound)` →
  `{ accessToken, user: { uid, username } }`. Verified server-side via `GET /v2/me`
  with `Authorization: Bearer <accessToken>`.
- **Payment (User-to-App):** `Pi.createPayment({amount, memo, metadata}, callbacks)`.
  The backend calls `POST /v2/payments/{id}/approve` then `/complete`, both with
  `Authorization: Key <PI_API_KEY>`.

## Notes
- The unlock store is in-memory and resets on server restart — fine for an MVP/sandbox.
  Swap `store` in `server.js` for a real datastore before relying on it in production.
- No external assets (no images), one Google Fonts link, and the Pi SDK are the only network
  dependencies — keeps it fast and review-friendly inside the Pi Browser.

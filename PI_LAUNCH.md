# Launching Pi Runner in the Pi Ecosystem (play-to-earn)

This is the exact, ordered checklist to take Pi Runner live as a play-to-earn
game on Pi. Steps marked **(you)** require your Pi account and can only be done
by you — the code for everything is already in the repo and wired behind feature
flags, so activation is just configuration + approvals.

> **Reality check on "play-to-earn":** Pi supports two earn mechanisms — (1)
> **rewarded ads** via the Pi Ad Network, and (2) **App-to-User (A2U) π payouts**
> from an app wallet you fund. Both require Pi Core Team approval, and Pi
> actively reviews reward-farming for abuse. Pi Runner is built to pass that
> review: rewards are **server-verified** (every run is re-simulated — a faked
> score earns nothing) and **daily-capped**. You control the economics in env.

## 0. Prerequisites
- The app runs today with **everything free** and payouts **off** (`PI_ADS_ENABLED=0`, `REWARDS_ENABLED=0`).
- Deploy target: any Node ≥ 18 host (Render / Railway / Fly / a VM). Build: `npm run build` (or ship the committed `public/`), start: `npm start`.

## 1. Register the app **(you)**
1. Open the **Pi Browser** → `pi://develop.pinet.com`.
2. **Register a new app** → note the app **username/slug**.
3. Set the app **URL** to your deployed HTTPS URL.
4. Copy the **API key** → set env `PI_API_KEY` on your host.
5. Download the **validation key** and replace `web/validation-key.txt` (served at your site root by the build) so Pi can verify domain ownership.

## 2. Deploy the backend **(you)**
- The frontend already loads the Pi SDK (`sdk.minepi.com/pi-sdk.js`).
- Set env from `.env.example`. Start the server. Confirm `GET /` loads and `GET /api/rewards/status` returns JSON.

## 3. Turn on Pi Login (Sandbox first)
- `web/src/config.ts` → `PI_AUTH_ENABLED: true` (already on), `PI_SANDBOX: true`.
- In the Pi Browser sandbox, open your URL → **Login with Pi** → confirm `@username` appears (server verifies the token via `/api/me`).

## 4. Enable rewarded ads (earn loop) **(you: request approval)**
1. Request **Pi Ad Network** access for your app in the Developer Portal.
2. Once approved, set `PI_ADS_ENABLED=1` (server) and `web/src/config.ts` → `PI_ADS_ENABLED: true`, rebuild.
3. The game shows **"Watch ad to REVIVE"** on game-over. Flow: client `Pi.Ads.showAd("rewarded")` → server verifies the `adId` via `GET /ads_network/status/:adId` → reward granted only when `mediator_ack_status === "granted"` (see `server/rewards.js` / `server/pi.js`).

## 5. Enable real-π rewards (A2U payouts) **(you: approval + wallet)**
1. Request **A2U / payments** capability for your app.
2. Create the app **wallet**; fund it with the π you intend to pay out.
3. On the host: `npm i pi-backend`, set env `PI_WALLET_PASSPHRASE` (the wallet secret) and `REWARDS_ENABLED=1`; set `web/src/config.ts` → `REWARDS_ENABLED: true`, rebuild.
4. Tune economics: `REWARD_PI_PER_TOKEN`, `REWARD_DAILY_CAP_PI`, `REWARD_MIN_CLAIM_PI`.
5. Verify: play a run → **Claim π reward** on game-over. The server re-simulates the run, enforces the daily cap + idempotency, then pays via `server/wallet.js` (`createPayment → submitPayment → completePayment`). Until the wallet is configured, claims are recorded as **pending** (nothing is minted).

## 6. Go to Mainnet
- After sandbox verification, request **Mainnet** in the Portal.
- `web/src/config.ts` → `PI_SANDBOX: false`, rebuild, redeploy.

## 7. Submit for review **(you)**
Pi's checklist typically wants: working app URL, validation key, a **Privacy
Policy** and **Terms** (see `PRIVACY.md` / `TERMS.md` — host them and link from
the Portal), a clear description, and screenshots. Emphasize the **anti-cheat
re-simulation + daily caps** — reviewers care about reward abuse.

## Anti-abuse summary (what protects your wallet)
- **Re-simulation:** rewards are computed from the score the server itself
  reproduces from your run's seed + input tape — a manipulated client earns 0.
- **Daily cap** per user (`REWARD_DAILY_CAP_PI`).
- **Idempotency:** one claim per run; one grant per ad `adId`.
- **Server-side only:** `PI_API_KEY` and the wallet passphrase never reach the client.

## What I could not do for you (account-gated)
Registering the app, obtaining approvals (ads, A2U, Mainnet), creating/funding
the wallet, holding the wallet secret, and deploying — these require your Pi
account and are intentionally left to you. Everything else is built and tested.

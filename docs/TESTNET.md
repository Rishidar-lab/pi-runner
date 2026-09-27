# Pi Testnet Integration — Verification Guide

_Prepared 2026-09-27. The server-side payment verification is implemented and
unit-tested. Real Pi Browser validation requires YOUR account — this guide
gives the exact checklist. Nothing here is marked verified until you run it._

## 0. What is already done (code-complete, unit-tested)

| Piece | Status |
|---|---|
| Pi SDK auth (`Pi.authenticate` → server `/api/me` token verification) | ✅ implemented |
| Payment creation with server approve → complete → cancel/error | ✅ implemented |
| **Server-side payment validation** (amount, memo, buyer, network, product) | ✅ implemented + 7 new unit tests |
| Access-token binding on every payment callback (uid from verified token, not client body) | ✅ implemented |
| Idempotent completion + interrupted-payment recovery (server re-fetches payment state) | ✅ implemented |
| Entitlement granted exactly once, only after verified completion | ✅ implemented |
| Product catalog is server-authoritative (`server/products.js`) | ✅ implemented |
| Feature flags keep everything dark until you flip them | ✅ `web/src/config.ts` |

## 1. Manual checklist (you — needs your Pi account)

**One-time setup:**
- [ ] **1.** Pi Browser → `pi://develop.pinet.com` → register a **Testnet** app
      (App Network = Testnet; immutable). Note the app slug.
- [ ] **2.** Set the app URL to your **HTTPS** deployment URL (Pi requires HTTPS;
      the Tailscale `http://100.125.204.16:3000` URL is for gameplay only — the Pi
      SDK will not initialize over plain HTTP).
- [ ] **3.** Copy the app's **Server API key**.
- [ ] **4.** On this machine, create the env file (never commit it):
      ```bash
      cd ~/pi-runner
      cp .env.example .env
      ```
      Then edit `~/.env` — no wait, edit `~/pi-runner/.env` — and set:
      ```
      PI_API_KEY=<your Testnet Server API key>
      PI_NETWORK=testnet
      ```
      Keep this file secret; it is git-ignored. **Never paste the key into chat.**
- [ ] **5.** Restart the server: `npm start` (it reads `.env` via the existing
      mechanism — or set the two env vars in your shell before `npm start`).
- [ ] **6.** In the Pi Browser sandbox (`https://sandbox.minepi.com`), open your
      app URL → Pi Utilities → **Authorize Sandbox**.

**Verification runs (do these in order, in the Pi Browser):**
- [ ] **A. Auth** — tap **Login with Pi** → your `@username` appears.
      → Server verified the token via `/api/me`. **Verified when:** username shows.
- [ ] **B. Product** — the Gold Orb unlock shows **1 π** (server catalog price).
- [ ] **C. Payment binding** — start the unlock → the payment dialog shows
      **1 π**, correct memo, your account as payer, Testnet network.
- [ ] **D. Approval** — server approves only after validating amount/memo/buyer/
      network against the catalog (a wrong amount is rejected with `409`).
- [ ] **E. Entitlement** — after completion, the unlock is granted **exactly once**
      (reloading and re-completing does not double-grant).
- [ ] **F. Interruption** — start a payment, close the browser mid-flow, reopen →
      the SDK's `onIncompletePaymentFound` fires → server re-fetches the payment
      and completes it when the tx is verified.
- [ ] **G. Cancel/failure** — cancel the payment → **no** entitlement granted.
- [ ] **H. Duplicate callbacks** — double-tap complete → idempotent, single grant.

## 2. What I cannot verify without you

- Real Pi authentication returning a validated identity.
- Real Testnet payment approve/complete/cancel against Pi's servers.
- The Pi Browser sandbox UI flow.

These need your Pi account + the Pi Browser on your phone. **I will not mark
A–H verified based on mocks or code inspection alone.**

## 3. Security notes for the Testnet phase

- `PI_NETWORK=testnet` makes the server **reject any Mainnet payment** and vice
  versa — wrong-network payments fail closed with `409 wrong_network`.
- The Server API key lives only in `~/pi-runner/.env` (git-ignored). Never commit.
- `PI_PAYMENTS_ENABLED` stays `false` in `web/src/config.ts` until A–H pass.
- Mainnet payments, A2U payouts, and monetized ads remain **disabled**.

## 4. If a payment gets stuck

```bash
# Check what the server recorded (no secrets):
curl -s http://127.0.0.1:3000/api/unlock-status?uid=<your-uid>
# Pi's view of any incomplete payment (Server API key required — run on host):
# GET https://api.minepi.com/v2/payments/incomplete_server_payments
```
The entitlement is granted only after Pi confirms `developer_completed` — a
stuck payment never yields a free unlock.

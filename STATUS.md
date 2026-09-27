# STATUS — Kurinji Run

_Last updated: 2026-09-27 (release-candidate prep). Honest state._

## ✅ Implemented & verified working

| Item | Evidence |
|---|---|
| Original endless runner (C++→WASM core + TS shell + Express backend) | **99/99 JS** tests green; typecheck clean; frontend-sync clean (Kali laptop, 2026-09-27). C++ core unchanged since Aug 28 (`bf3eeac`), re-verified via WASM re-simulation test; native `test:core` needs `cmake` (not installed on this box; CI runs it). |
| Server-side score validation (re-simulation from seed+tape) | `npm run test:js` — inflated scores rejected with server-computed truth |
| Node Challenge (local verified leaderboard, replay prevention) | challenge suites green |
| **Server-side payment validation** | `server/products.js` + `server/payment-verify.js`; server-authoritative catalog; token-verified `uid` per request; endpoints fail closed without API key |
| **Server-side payment GATE (NEW)** | `PI_PAYMENTS_ENABLED` (default OFF) + `PI_ALLOW_MAINNET` (default OFF) enforced in `/api/approve` + `/api/complete`; a stray API key or `PI_NETWORK=mainnet` can never move real Pi. Proved by 30 route-level adversarial tests (`tests/payment-routes.test.mjs`). |
| **HTTPS for Testnet** | `scripts/https-testnet.sh` exposes only app port 3000 over TLS via existing Tailscale (`serve`=tailnet-only, `funnel`=public). Target URL `https://rishidar.tail9a2b37.ts.net` once tailnet HTTPS is enabled. |
| Tamil + English i18n | `web/src/i18n.ts`; mobile layout tested, no overflow |
| Seasonal leaderboards (explicit UTC quarters) | `GET /api/leaderboard?season=…` live-tested |
| Strict CSP, no eval (DYNAMIC_EXECUTION=0) | browser test: zero page errors |
| Watch-only wallet companion | `~/pi-wallet-companion` on :3100; GET-only vs official Horizon API; frontend has only a public-address field + "never enter passphrase/seed" warning; no POST/sign/passphrase/private-key anywhere |
| **Phone access via Tailscale** | game on `0.0.0.0:3000`; phone (medusa-v) active on same tailnet. Plain HTTP is for gameplay only — NOT proof of Pi SDK integration. |
| Mobile playability (desktop emulation, 390×844, touch) | tap-to-play, pause/resume, game-over/retry, 60.3 FPS, Tamil layout clean |
| `.env` loader (no dotenv dep) | `server/env.js` — real env wins, values never logged |

## 🧪 Experimental / not independently verified
- **Real Pi auth + Testnet payment flow** — code complete + unit-tested, but
  requires your Pi Browser + account. See `docs/TESTNET.md` checklist A–H.
  **Not marked verified.**
- Rewarded ads: server verification implemented; no approval, no real ad traffic.
- A2U payouts: disabled; needs approval + funded wallet.
- Independent wallet signer: **not built** (no official derivation vectors;
  watch-only only — and missing vectors is never a reason to ask for a
  passphrase).

## ⏳ Awaiting your action / external approval
1. **Play now**: `npm start`, then open the game on your phone via the tailnet —
   gameplay only, no Pi features (plain HTTP; the Pi SDK needs HTTPS).
2. **Enable tailnet HTTPS** (one-time, Tailscale admin console): enable MagicDNS
   + HTTPS certificates, then `./scripts/https-testnet.sh serve`.
3. **Pi Testnet verification**: follow `docs/TESTNET.md` (register Testnet app,
   set `PI_API_KEY` + `PI_NETWORK=testnet` + `PI_PAYMENTS_ENABLED=1` in
   `~/pi-runner/.env`, build a test frontend with the client flag on, sandbox
   authorize, run checklist A–H).
4. **Approvals**: Ad Network, A2U, Mainnet listing (`docs/LISTING.md`).
5. **Pi node**: NOT an MVP blocker. This Kali laptop has ~341 GB free; the
   2.7 GB constraint was the other host. See `docs/NODE_FEASIBILITY.md`.
6. **Security inquiry**: draft in `docs/SECURITY_FINDINGS.md` — unsent.

## 🚫 Cannot be supported by evidence
- Node reward guarantees (sources contradictory).
- "Play to earn" (no funded, approved mechanism).
- Recovery of unverified Pi (`docs/BALANCE_ACTIONS.md`).
- A public Pi bug bounty (not verified — none found on primary sources).

## 📁 Deliverables map
```
~/pi-runner/            game + server + docs + RUNBOOK + STATUS (branch solohost/pi-runner)
~/pi-wallet-companion/  watch-only wallet (port 3100)
~/kurinji-run-tracker.csv  daily economics tracker
```

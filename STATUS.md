# STATUS — Kurinji Run

_Last updated: 2026-09-27 (release-candidate prep). Honest state._

## ✅ Implemented & verified working

| Item | Evidence |
|---|---|
| Original endless runner (C++→WASM core + TS shell + Express backend) | 70/70 C++ + 69/69 JS tests green; typecheck clean |
| Server-side score validation (re-simulation from seed+tape) | `npm run test:js` — inflated scores rejected with server-computed truth |
| Node Challenge (local verified leaderboard, replay prevention) | challenge suites green |
| **Server-side payment validation** (NEW) | `server/products.js` + `server/payment-verify.js`; 7 new unit tests; endpoints fail closed without API key; token verified per-request |
| Tamil + English i18n | `web/src/i18n.ts`; mobile layout tested, no overflow |
| Seasonal leaderboards (explicit UTC quarters) | `GET /api/leaderboard?season=…` live-tested |
| Strict CSP, no eval (DYNAMIC_EXECUTION=0) | browser test: zero page errors |
| Watch-only wallet companion | `~/pi-wallet-companion` on :3100, tested vs official Horizon API |
| **Phone access via Tailscale** | game on `0.0.0.0:3000`; `http://100.125.204.16:3000` returns 200; phone (medusa-v) on same tailnet |
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
1. **Play now**: `http://100.125.204.16:3000` in your phone's browser (same
   Tailnet) — gameplay only, no Pi features.
2. **Pi Testnet verification**: follow `docs/TESTNET.md` (register Testnet app,
   set `PI_API_KEY` + `PI_NETWORK=testnet` in `~/pi-runner/.env`, HTTPS deploy,
   sandbox authorize, run checklist A–H).
3. **Approvals**: Ad Network, A2U, Mainnet listing (`docs/LISTING.md`).
4. **Disk decision for Pi node**: infeasible at 2.7 GB free vs 150 GB official
   minimum (`docs/NODE_FEASIBILITY.md`).
5. **Security inquiry**: draft in `docs/SECURITY_FINDINGS.md` — unsent.

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

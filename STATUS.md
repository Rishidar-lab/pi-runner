# STATUS — Kurinji Run (ex-"Pi Runner")

_Last updated: 2026-09-27. Honest state: what works, what's blocked, what's yours._

## ✅ Implemented & verified working

| Item | Evidence |
|---|---|
| Original endless runner (C++→WASM deterministic core + TS shell) | 70/70 C++ assertions, 62/62 JS tests green |
| Server-side score validation (re-simulation from seed+tape) | `npm run test:js` — inflated scores rejected with server-computed truth |
| Node Challenge (local verified leaderboard, daily seed, replay prevention) | challenge test suites green |
| Payments/auth/ads/A2U behind feature flags (all OFF by default) | `web/src/config.ts`; server routes implemented + tested |
| Tamil + English UI (i18n, persisted, settings toggle) | `web/src/i18n.ts` — new |
| Seasonal leaderboards (explicit UTC quarters, verified runs only) | `GET /api/leaderboard?season=…` — new, live-tested |
| Watch-only wallet companion (official Horizon API) | `~/pi-wallet-companion` — live on :3100, tested |
| Research: sources, balance actions, earning routes, competitors, growth, security findings, node feasibility, economics | `docs/*.md` |
| Scenario model (seeded, labelled assumptions) | `scripts/scenario.mjs` — runs |

## 🧪 Experimental / not independently verified

- Pi login & payments: code complete, **not exercised** (needs Pi Browser +
  your account + sandbox). Never claimed as working.
- Rewarded ads: server verification implemented; no approval, no real ad traffic.
- A2U payouts: disabled; needs approval + funded wallet.
- Independent wallet signer: **BLOCKED** — Pi publishes no passphrase→key
  derivation vectors; cannot validate without your real passphrase (which must
  never be shared). Watch-only only.

## ⏳ Awaiting your action / external approval

1. Pi Developer Portal registration (Testnet + Mainnet apps) — `pi://develop.pinet.com`.
2. Sandbox verification of login + cosmetic payment.
3. Ad Network approval (if ads wanted); A2U approval + wallet (if payouts wanted).
4. Mainnet listing submission (see docs/LISTING.md).
5. Disk decision for the Pi node (~150 GB — see docs/NODE_FEASIBILITY.md).
6. Security inquiry email — draft ready in docs/SECURITY_FINDINGS.md (DO NOT SEND without approval).

## 🚫 Cannot be supported by evidence

- Any guarantee of node rewards (sources contradictory).
- Any "play to earn" promise (no funded, approved mechanism).
- Recovery/conversion of unverified Pi (depends on your KYC/migration status in
  the official app — see docs/BALANCE_ACTIONS.md).
- A public Pi bug bounty (not verified — none found on primary sources).

## 📁 Deliverables map

```
~/pi-runner/            game + server + docs (SOURCES, BALANCE_ACTIONS, EARNING_ROUTES,
                        COMPETITORS, GROWTH, SECURITY_FINDINGS, NODE_FEASIBILITY,
                        ECONOMICS, LISTING) + RUNBOOK + STATUS
~/pi-wallet-companion/  watch-only wallet tool (port 3100)
~/kurinji-run-tracker.csv  daily economics tracker (copy from docs/ECONOMICS.md §5)
```

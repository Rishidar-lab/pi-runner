# RUNBOOK — Kurinji Run

_Operating guide. Updated 2026-09-27._

## 1. Play on your phone (private, no Pi features)

```bash
cd ~/pi-runner
npm start            # listens on 0.0.0.0:3000
```

Open in your phone's browser (same Tailnet):

```
http://100.125.204.16:3000
```

- Verified: returns 200; phone `medusa-v` is on the same Tailscale network.
- This is **plain HTTP** — fine for gameplay, but the **Pi SDK will not
  initialize** (Pi requires HTTPS). Use this for play/testing only.
- No admin services exposed; no router/firewall changes made.

## 2. Pi Browser integration testing (requires HTTPS)

The Pi SDK needs an HTTPS app URL. Options: deploy the committed `public/` to
any HTTPS host (Render/Railway/Fly/a VM with TLS), or use Pi's sandbox URL.
See `docs/TESTNET.md` for the full checklist. **Do not weaken CORS/CSP to make
local HTTP work** — that is not a deployment fix.

## 3. Daily operations

```bash
cd ~/pi-runner
npm install          # express only
npm test             # 70 C++ + 69 JS assertions — must be green
npm run typecheck    # tsc --noEmit
npm start            # http://localhost:3000 (reads .env via server/env.js)
```

SoloHost container (hardened):
```bash
docker compose -f docker-compose.solohost.yml up -d --build
curl http://127.0.0.1:3000/api/health
```

Wallet companion (watch-only, port 3100):
```bash
cd ~/pi-wallet-companion && npm install && npm start
```

## 4. Feature flags — `web/src/config.ts`

| Flag | Default | Flip only when |
|---|---|---|
| `PI_AUTH_ENABLED` | true | always safe; degrades outside Pi Browser |
| `PI_PAYMENTS_ENABLED` | **false** | Testnet checklist A–H all pass |
| `PI_SANDBOX` | true | Mainnet payment access granted |
| `LEADERBOARD_ENABLED` | true | — |
| `PI_ADS_ENABLED` | **false** | Pi Ad Network approval granted |
| `REWARDS_ENABLED` | **false** | A2U approval + funded wallet + abuse controls |

Server env (in `~/pi-runner/.env`, git-ignored): `PI_API_KEY`,
`PI_NETWORK` (testnet|mainnet), `PI_ADS_ENABLED`, `REWARDS_ENABLED`,
`REWARD_*`, `PI_WALLET_PASSPHRASE` (production host only).

## 5. Incident procedures

**Forged/inflated score:** server re-simulates; mismatch → 400 with
`serverScore`. By design.

**Payment validation failure (409):** the server rejected a payment whose
amount/memo/buyer/network/product did not match the catalog. Check
`docs/TESTNET.md` §4. No entitlement is ever granted on a 409.

**Duplicate payment callback:** `/api/complete` is idempotent (one grant per
payment; Pi's `developer_completed` re-checked on conflicts).

**Ad reward not granted:** reward only when Pi returns
`mediator_ack_status === "granted"`. No server ack → no entitlement.

**Node Challenge unavailable:** falls back to menu with a toast. Local
verification ≠ Pi blockchain validation.

**Tampered local save:** C++ core checksum-guards the profile; bad checksum →
reset. Expected behaviour.

## 6. Testing procedures

```bash
npm test                 # full suite
npm run test:js          # backend (incl. 7 payment-validation tests)
npm run test:core        # C++ determinism/anti-cheat
```

API smoke (server running):
```bash
curl -s localhost:3000/api/health
curl -s localhost:3000/api/products
curl -s "localhost:3000/api/leaderboard?season=current&limit=5"
# Payment endpoints fail closed without PI_API_KEY (expected):
curl -s -X POST localhost:3000/api/approve -H 'Content-Type: application/json' \
  -d '{"paymentId":"x","productId":"gold_shield_unlock_v1"}'
```

## 7. Backup & rollback

- Game store: `server/data/*.json` (atomic writes) — back up the directory.
- Rollback: `git checkout <commit>`; container image reproducible from
  committed artifacts (no emcc at runtime).
- `.env` is git-ignored; never commit keys.

## 8. Security boundaries (standing)

- Never enter a Pi passphrase/seed into any tool, prompt, log, or screenshot.
- `PI_API_KEY` / wallet secrets: server-side env only (`.env`, git-ignored).
- No active testing against Pi production systems (no authorised scope —
  `docs/SECURITY_FINDINGS.md`).
- Watch-only companion: public addresses only.
- Payment callbacks are untrusted: every callback carries the access token;
  the server re-verifies identity and re-fetches the payment from Pi before
  approving/completing.

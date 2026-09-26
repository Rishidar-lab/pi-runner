# RUNBOOK — Kurinji Run

_Operating guide. Date: 2026-09-27._

## 1. Daily operations

```bash
cd ~/pi-runner
npm install          # express only
npm test             # 70 C++ + 62 JS assertions — must be green
npm run typecheck    # tsc --noEmit
npm start            # http://localhost:3000
```

SoloHost container (hardened, non-root, read-only rootfs):

```bash
docker compose -f docker-compose.solohost.yml up -d --build
curl http://127.0.0.1:3000/api/health
```

Wallet companion (watch-only, port 3100):

```bash
cd ~/pi-wallet-companion && npm install && npm start
# open http://localhost:3100 — paste a PUBLIC address only
```

## 2. Feature flags — `web/src/config.ts`

| Flag | Default | Flip only when |
|---|---|---|
| `PI_AUTH_ENABLED` | true | always safe; degrades outside Pi Browser |
| `PI_PAYMENTS_ENABLED` | **false** | sandbox approve→complete→cancel→error verified |
| `PI_SANDBOX` | true | Mainnet payment access granted |
| `LEADERBOARD_ENABLED` | true | — |
| `PI_ADS_ENABLED` | **false** | Pi Ad Network approval granted |
| `REWARDS_ENABLED` | **false** | A2U approval + funded app wallet + abuse controls |

## 3. Incident procedures

**Forged/inflated score submission:** server re-simulates; mismatch → 400 with
`serverScore`. Check `GET /api/leaderboard` (verified entries only). No action
needed — by design.

**Duplicate payment callback:** `/api/complete` is idempotent (one grant per
paymentId). If a user reports a stuck payment: check
`GET /api/unlock-status?uid=…`; the Pi Platform API
`/payments/incomplete_server_payments` shows server-side state. Never grant
manually from client claims.

**Ad reward not granted:** client shows "watch ad to revive"; server verifies
`adId` via `/ads_network/status/:adId`; reward only when
`mediator_ack_status === "granted"`. If not granted, the user keeps playing —
no entitlement without server ack.

**Node Challenge unavailable:** game falls back to menu with a toast. Local
verification needs the game server up; it is NOT Pi blockchain validation.

**Tampered local save:** C++ core checksum-guards the profile; bad checksum →
reset to defaults. Expected behaviour, not an incident.

**Disk pressure on game server:** store is a JSON file; prune via restart
(MAX_SCORES cap) — monitor `df -h` if the host is shared.

## 4. Testing procedures

```bash
npm test                 # full suite
npm run test:core        # C++ determinism/anti-cheat
npm run test:js          # backend payments/leaderboard/challenge
```

E2E smoke (server running):

```bash
curl -s localhost:3000/api/health
curl -s "localhost:3000/api/leaderboard?season=current&limit=5"
curl -s -X POST localhost:3000/api/score -H 'Content-Type: application/json' \
  -d '{"seed":1,"steps":0,"tapeSteps":[],"tapeCmds":[],"score":0,"coins":0,"distance":0}'
# → expect ok:true verified:true (empty run) — then try score:999999 → expect score mismatch
```

## 5. Backup & rollback

- Game store: `server/data/*.json` (atomic writes) — back up the directory.
- Wallet companion: stateless; Horizon API is the source of truth.
- Rollback: `git checkout <tag>`; container image is reproducible from
  committed artifacts (no emcc at runtime).

## 6. Security boundaries (standing)

- Never enter a Pi passphrase/seed into any tool, prompt, log, or screenshot.
- `PI_API_KEY` / wallet secrets: server-side env only.
- No active testing against Pi production systems (no authorised scope — see
  docs/SECURITY_FINDINGS.md).
- Watch-only companion: public addresses only.

# Pi Runner — Node Challenge

**Local-first deterministic gaming infrastructure on Pi SoloHost.**

Every SoloHost install of Pi Runner is a local game server *and* a deterministic
verification node. Players get a shared, server-issued challenge seed; the
browser plays the run and records an input tape; the SoloHost backend
**independently re-simulates the run with the exact same C++ simulation core**.
Only a run the node can reproduce becomes **VERIFIED** and reaches the
leaderboard.

```
Player
  ↓
Pi Browser / browser frontend
  ↓  deterministic C++/WASM simulation
  ↓  input tape (seed + per-tick commands)
SoloHost Node
  ↓  server-side deterministic replay (same core, driven tick-by-tick)
  ↓  score / distance / π reproduced from scratch
  ↓  VERIFIED  or  REJECTED (with a reason code)
Node Challenge leaderboard  (verified runs only)
```

---

## 1. Purpose

Give SoloHost a real gameplay role, not just "a web game in a container". The
node is the authority. A browser cannot inflate a score, pick an easier seed,
replay an old run, or claim a leaderboard place — the node decides all of that by
re-running the simulation itself.

## 2. Threat model

| # | Threat | Mitigation |
|---|--------|------------|
| 1 | **Score / distance / π spoofing** | The node re-simulates the run from the issued seed + input tape and compares every claimed number. Mismatch → `SCORE_MISMATCH` / `DISTANCE_MISMATCH` / `COINS_MISMATCH`. |
| 2 | **Replay reuse** | Each run is a server-issued session with an unpredictable 128-bit `runId`. A `runId` resolves exactly once (`RUN_ALREADY_USED`); re-submits of a finished run return the stored result idempotently. |
| 3 | **Arbitrary / easier seed** | The client never chooses the seed. `POST /api/challenge/start` issues it, bound to the current challenge and signed with the node's secret key (`SEED_MISMATCH` / `INVALID_RUN_ID` if altered). |
| 4 | **Truncated / padded runs** | A VERIFIED run must end in `GameOver` at *exactly* the claimed tick count (`REPLAY_INCOMPLETE`, `FINAL_TICK_MISMATCH`). |
| 5 | **Request flooding** | Per-endpoint in-memory rate limits (start 30/min, submit 20/min, reads 120/min) plus a blanket 240/min on `/api/`. |
| 6 | **Gigantic payloads** | Global JSON body limit 256 kB; challenge submit limited to 192 kB; tape capped at 4096 entries and 216 000 ticks (30 min). |
| 7 | **Malformed tapes** | Strict structural validation *before* any CPU is spent on replay — id/seed formats, non-decreasing tick order, bounded input burst per tick, command range 1–4, integer non-negative claimed totals, no `NaN`/`Infinity`. |
| 8 | **Duplicate submission races** | The session state machine only allows `ISSUED/STARTED → SUBMITTED` once; a concurrent second submit gets `RUN_IN_PROGRESS`. |
| 9 | **Timing abuse** | Sessions expire (`CHALLENGE_RUN_TTL_MINUTES`, default 20). Expired → `RUN_EXPIRED`. |
| 10 | **Path traversal** | No user-controlled filesystem paths. `runId` (`^[a-f0-9]{32}$`) and `challengeId` (`^[a-z-]+:[0-9A-Za-z-]+:v\d+$`) are format-validated before use as map keys. |
| 11 | **Prototype pollution** | Every store map key passes a `__proto__`/`constructor`/`prototype` guard. Tapes are arrays of numbers; client JSON is never used as code. |
| 12 | **Env / secret exposure** | `/api/health`, `/api/node/status` return only whitelisted fields. The node signing secret never leaves the process. No filesystem paths in any response. |
| 13 | **Pay-to-win** | Challenge runs are always re-simulated (and played) with `unlockShield=false`, `skin=0`. Cosmetics never touch the simulation. |
| 14 | **Identity spoofing** | With `PI_API_KEY` set, a submission's Pi access token is verified against the Pi Platform API. Unauthenticated players get a `local:` identity that is prefixed and name-suffixed so it can never be mistaken for a verified Pi user. |

Out of scope (documented, not solved here): a determined attacker automating
*legitimate* play; cross-node trust / global aggregation (see §13).

## 3. Deterministic architecture

The C++17 core (`core/`) is deterministic by contract: same `(seed, ordered
input commands, fixed 120 Hz timestep)` ⇒ byte-identical results on every
target. It compiles to WebAssembly once and is used, unchanged, in three places:

- the **browser** (`web/src/core/`), stepping the run and tagging each input
  with its exact tick index;
- the **committed node build** (`server/pirun_core_node.js`, wasm embedded) that
  the classic leaderboard verifier already uses;
- **Node Challenge replay** (`server/challenge/replay.js`), which drives that
  same node build one `advance(1/120)` at a time.

There is exactly one gameplay implementation. `server/simcore.js` is the single
shared handle to it.

## 4. Challenge creation

`server/challenge/challenge.js`.

**Id** — deterministic, human-readable, carries the rules version:

```
daily:<UTC-date>:v<RULES_VERSION>        e.g.  daily:2026-08-31:v1
```

The UTC date comes from **server** time. Same UTC day ⇒ same challenge, at any
hour. A new day, or a `RULES_VERSION` bump, is a new id (and a fresh
leaderboard).

**Seed** — HMAC-SHA256, truncated to a `uint32`:

```
material = "pi-runner/node-challenge" | <type> | <UTC-date> | "rules="<R> | "sim="<S>
digest   = HMAC_SHA256(key = NAMESPACE_KEY, message = material)
seed     = digest.readUInt32BE(0)
```

`NAMESPACE_KEY` defaults to a **fixed public string**
(`pi-runner/node-challenge/public-namespace/v1`). Consequence: *every* Pi Runner
node on Earth derives the **same** daily seed with no shared secret and no
coordination — the prerequisite for a future cross-node "same course everywhere"
challenge.

Setting `NODE_CHALLENGE_SECRET` overrides the key. Use it only for a private,
single-node challenge where you want the seed unpredictable until the day opens;
that node's leaderboard is then deliberately incomparable with others.

No `Math.random`, no `Date`-derived entropy — the seed is a pure function of
`(namespace, type, date, rules, sim)`.

## 5. Run lifecycle

`server/challenge/sessions.js`.

```
POST /api/challenge/start
  → session { runId (random 128-bit), challengeId, seed, issuedAt, expiresAt,
              rulesVersion, simulationVersion, tapeVersion, token (HMAC) }
  status: ISSUED

client plays exactly that seed, records the tape

POST /api/challenge/submit  { runId, challengeId, seed, versions, steps,
                              tapeSteps[], tapeCmds[], claimed{score,distance,coins},
                              accessToken? | localName? }
  ISSUED → STARTED → SUBMITTED         (each with a timestamp)
  → authoritative replay
      match   → VERIFIED   (entry published to the leaderboard)
      no match→ REJECTED   (reason code; nothing published)

past expiresAt while still ISSUED/STARTED → EXPIRED  (lazy, on next load)
```

Illegal transitions throw. `VERIFIED` / `REJECTED` / `EXPIRED` are terminal.

## 6. Input tape

`server/challenge/tape.js`. Tape version **1**:

| field | rule |
|-------|------|
| `runId` | `^[a-f0-9]{32}$` |
| `challengeId` | `^[a-z-]+:[0-9A-Za-z-]+:v\d+$`, ≤ 64 chars |
| `seed` | integer `0 … 2³²−1` |
| `simulationVersion` | exact match to the node's `SIMULATION_VERSION` |
| `tapeVersion` | `1` |
| `steps` | integer `1 … 216000` |
| `tapeSteps[]` | non-decreasing integers in `[0, steps)`; ≤ `8` on any single tick |
| `tapeCmds[]` | same length as `tapeSteps`; each in `{1 Left, 2 Right, 3 Jump, 4 Slide}` (`0/None` rejected) |
| `claimed.{score,distance,coins}` | integer, `≥ 0`, finite |

Anything else → `INVALID_INPUT_TAPE` / `VERSION_MISMATCH` / `TAPE_TOO_LONG` /
`RUN_TOO_LONG` before replay runs.

## 7. Server replay

`server/challenge/replay.js`.

```
reset(seed, unlockShield=false, skin=0); start()
for tick in 0 … steps-1, while state != GameOver:
    apply every tape entry whose step == tick
    advance(1/120)
read score() / coins() / distance() / state() / tick count
```

VERIFIED iff **all** of: `endState == GameOver`, `ticksRun == steps`,
`score == claimed.score`, `distance == claimed.distance`,
`coins == claimed.coins`.

Rejections return a reason code **only** — the node's own numbers are not
disclosed (they'd help a cheat calibrate). Reason codes:
`INVALID_RUN_ID`, `RUN_ALREADY_USED`, `RUN_IN_PROGRESS`, `RUN_EXPIRED`,
`SEED_MISMATCH`, `CHALLENGE_MISMATCH`, `VERSION_MISMATCH`, `INVALID_INPUT_TAPE`,
`TAPE_TOO_LONG`, `RUN_TOO_LONG`, `SCORE_MISMATCH`, `DISTANCE_MISMATCH`,
`COINS_MISMATCH`, `REPLAY_INCOMPLETE`, `FINAL_TICK_MISMATCH`, `REPLAY_ERROR`,
`AUTH_REQUIRED`, `AUTH_INVALID`.

**Performance** (`node scripts/bench-replay.mjs`, ordinary laptop): the core
re-simulates ~30 000× realtime. A typical crashed run (~900 ticks) verifies in
~0.15 ms; the 30-minute hard cap (216 000 ticks) in ~50 ms. Linear in tick count.

## 8. Leaderboard

`server/challenge/coordinator.js` + `server/store.js`.

- **VERIFIED submissions only.**
- One row per identity (best score kept); one row per `runId`.
- Isolated per `challengeId` — yesterday's board never contaminates today's.
- Bounded retention: `CHALLENGE_RETENTION_DAYS` (default 30), ≤ 500 rows/challenge.
- A row is `{ rank, username, identityKind, score, distance, coins, verified:true,
  nodeIdShort, verifiedAt }`.

APIs: `GET /api/challenge/leaderboard?challengeId=…&limit=…`,
`GET /api/challenge/me?challengeId=…&uid=…|name=…`.

## 9. Node identity

`server/node/identity.js`.

- `nodeId` = 128-bit `crypto.randomBytes(16)`, generated once on first boot,
  persisted in the store, stable across restarts.
- **Not** a hostname, MAC, or hardware fingerprint. No telemetry.
- A separate 256-bit secret signs run tokens; it never leaves the process and is
  never serialized to any API.
- UI sees only `Node <first 6 hex, uppercased>` (e.g. `Node 7F3A92`).

## 10. SoloHost architecture

```
web/src (TypeScript)  ──build──▶  public/ (committed, plain ES modules)
core/ (C++17)          ──emcc──▶  public/core/pirun_core.js  +  server/pirun_core_node.js
                                   (both committed, wasm embedded — no emcc at install)

Dockerfile: npm ci --omit=dev ; COPY server/ public/ ; USER node ; node server/server.js
docker-compose.solohost.yml: localhost-only, read-only rootfs, cap_drop ALL,
                             no-new-privileges, init:true, one /data volume, healthcheck → /api/health
```

`npm run build:frontend` refreshes `public/` from `web/src` **without** emcc, for
contributors on a machine with no toolchain.

The committed `public/core/pirun_core.js` and `server/pirun_core_node.js` are
produced by a single `npm run build:dist` run from the same `core/` sources, so
the browser and the server re-simulate identical logic. CI (`wasm-build`)
rebuilds both on every push and diffs them against git; that diff is currently a
**warning, not a failure**, because Emscripten's byte output drifts between emsdk
versions and the version that produced the committed blobs is not yet pinned.

**Follow-up:** pin the exact emsdk version in `scripts/build-wasm.sh` /
`scripts/build-dist.mjs` and in `.github/workflows/ci.yml` (`wasm-build` uses
`version: latest` today), then make the `build:dist` reproducibility diff fatal
so a stale committed core can never be merged.

## 11. Privacy

- No accounts required. Local play uses a name you type, stored only in your
  browser and sent to your own node.
- Pi identity is used only when you sign in; the access token is verified
  server-side and never stored.
- The node persists: its own id, run sessions (48 h), verified leaderboard rows
  (30 days), and daily verified/rejected counts. No IP logging. No input tapes
  are logged.
- Everything lives in one `/data` volume on your machine.

## 12. Current limitations

- **Node Challenge provides local authoritative verification on a single
  SoloHost installation. It is NOT a decentralized consensus protocol, NOT a Pi
  blockchain validation mechanism, and does NOT aggregate results across nodes.**
- Two nodes using the public seed namespace play the *same course* but keep
  *separate* leaderboards. There is no cross-node trust yet.
- Re-simulation stops fabricated scores. It does not stop a bot that plays
  legitimately well.
- The store is a single JSON file with atomic writes — right for SoloHost scale,
  not for thousands of concurrent nodes.
- The emsdk version that built the committed WASM cores is not pinned, so CI's
  reproducibility check is a warning rather than a hard gate (see §10). The
  cores are still built from one source tree in one run; only the toolchain
  version is unfixed.

## 13. Future distributed extension

The seam already exists (`server/challenge/coordinator.js`):

```
ChallengeCoordinator      getCurrentChallenge / getChallenge / publishVerifiedRun / getLeaderboard
LeaderboardProvider       read model for federated rankings
NodeFederationAdapter     register(node) / submitVerifiedRun(signedEntry) / fetchChallenge()
```

Today: `LocalChallengeCoordinator` (JSON store, no network).

A future `PiNetworkChallengeCoordinator` would implement the **same** surface:
pull the shared challenge from a coordinator, and push node-signed VERIFIED
results (the node already signs run tokens with its key) upstream for
aggregation. The routes, the session state machine, and the replay pipeline
would not change. This milestone does **not** ship, stub as working, or pretend
Pi provides such a coordinator — it only makes sure the local implementation
won't be in the way when one exists.

## 14. Versioning

`server/version.js` — independent of `package.json`:

| constant | bump when | gates verification |
|----------|-----------|--------------------|
| `APP_VERSION` (2.1.0) | any release | no |
| `SIMULATION_VERSION` (1.0.0) | the C++ core's deterministic behaviour changes | **yes — exact match, fail closed** |
| `RULES_VERSION` (1) | challenge rules change | via the challenge id |
| `TAPE_VERSION` (1) | the tape wire format changes | **yes — exact match** |

A run recorded under a different `SIMULATION_VERSION` is rejected
(`VERSION_MISMATCH`) rather than mis-verified against different rules.

## 15. Demo mode

`NODE_CHALLENGE_DEMO=1` lets a node that *does* have `PI_API_KEY` still accept
local (unauthenticated) identities, for demoing the full flow without signing in.
It does **not** bypass verification — every run is still re-simulated. A node
with no `PI_API_KEY` already allows local identities (the normal local-first
case), so the flag is only needed on a credentialled node.

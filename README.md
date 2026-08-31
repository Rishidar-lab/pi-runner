# Pi Runner 🏃‍♂️π

A polished 2D **Pi-themed endless runner** for the Pi ecosystem. Dash through a
neon Pi grid, switch lanes, **jump** hurdles, **slide** under bars, bank **π**,
chain combos, grab power-ups, complete missions, and climb a **cheat-resistant
leaderboard**.

> **Architecture at a glance — a hybrid build.** The game's deterministic
> simulation "model" (player state, movement, obstacles, collectibles, scoring,
> seeded procedural generation) is written in **C++** and compiled to
> **WebAssembly**. Rendering, input, UI, audio, persistence and the Pi SDK live
> in a clean **TypeScript** shell. The backend is **Node/Express**. Because the
> core is deterministic, the server can **re-simulate any run from its seed +
> input tape** to validate leaderboard scores — real anti-cheat, not trust.

> **Node Challenge (SoloHost).** Every SoloHost install is a local game server
> *and* a deterministic verification node. Players get a server-issued daily seed
> (HMAC-derived — same course on every node), play the run, and submit the input
> tape; the node independently re-simulates it with the same C++ core and only a
> reproduced run becomes **VERIFIED**. The browser is never the authority for
> score, distance, π, or leaderboard placement. Full design →
> [`NODE_CHALLENGE.md`](./NODE_CHALLENGE.md), demo →
> [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md).

<sub>Note: Pi ecosystem apps run inside the **Pi Browser** and must be web apps.
Native C++ can't run there, so the C++ core is delivered as WebAssembly and
wrapped in the web shell that loads the Pi SDK — the standard, supported way to
use C++ on Pi.</sub>

---

## Project layout

```
pi-runner/
├─ core/                        # C++17 deterministic core ("the model")
│  ├─ include/pirun/pirun.hpp    # types, config, RNG, Simulation, Profile
│  ├─ src/sim.cpp                # simulation implementation
│  ├─ bindings/wasm.cpp          # Emscripten/embind exports
│  ├─ tests/test_sim.cpp         # native C++ test suite (no framework)
│  └─ CMakeLists.txt             # native build for tests + re-sim tooling
├─ web/                         # TypeScript shell (browser)
│  ├─ src/
│  │  ├─ main.ts                 # orchestrator + fixed-step game loop
│  │  ├─ core/coreLoader.ts      # typed WASM wrapper
│  │  ├─ render/renderer.ts      # 2.5D perspective canvas renderer
│  │  ├─ input/input.ts          # keyboard + touch gestures + buttons
│  │  ├─ ui/ui.ts                # screens, HUD, toasts
│  │  ├─ audio/audio.ts          # procedural Web Audio SFX + music
│  │  ├─ persistence/store.ts    # save abstraction (cloud-ready)
│  │  ├─ pi/piAdapter.ts         # Pi auth + payment adapter (feature-flagged)
│  │  ├─ game/                    # skins, achievements, missions/dailies
│  │  └─ config.ts               # FEATURE FLAGS
│  ├─ index.html · style.css
├─ server/                      # Node/Express backend
│  ├─ server.js                  # routes + static hosting
│  ├─ pi.js · store.js           # Pi API wrapper · persistent store
│  └─ leaderboard.js             # re-simulation verifier (anti-cheat)
├─ scripts/                     # build-wasm.sh · build-web.mjs · build-preview.mjs
├─ tests/payment-state.test.mjs # backend payment + leaderboard tests
└─ package.json
```

## Prerequisites

| Tool | Why | Notes |
|------|-----|-------|
| **Node ≥ 22.6** | build + server | Uses Node's built-in TypeScript transform (no bundler dependency). |
| **Emscripten 6.0.8** (`emcc`) | compile C++ → WASM | Pinned. `emsdk install 6.0.8 && emsdk activate 6.0.8`. `build:dist` refuses any other version; CI gates the committed WASM on it. |
| **CMake + a C++17 compiler** | run the native test suite | e.g. `gcc-c++`/`clang`. Not needed to run the game. |

## Build & run

```bash
npm install                 # installs express (the only runtime dep)

# 1) compile the C++ core to WebAssembly (web + node targets)
npm run build:wasm          # requires emcc on PATH

# 2) build the web app into public/  (transpiles TS -> native ES modules)
npm run build:web

# …or do both:
npm run build

# 3) start the server (serves public/ + the API)
npm start                   # http://localhost:3000
```

> **Local play:** open `http://localhost:3000` in any desktop/mobile browser and
> the game is fully playable. Pi **login/payments** only function inside the Pi
> Browser — elsewhere those buttons show a friendly "open in the Pi Browser"
> message instead of erroring.

### Tests

```bash
npm test            # runs both suites
npm run test:core   # 70 native C++ assertions (RNG, saves, collisions, scoring, determinism, spawn solvability)
npm run test:js     # 62 tests: backend payment state, classic + Node Challenge anti-cheat, replay, rewards
npm run test:challenge  # just the Node Challenge suites
npm run typecheck   # tsc --noEmit over web/src
```

### Standalone playable preview (optional)

```bash
# builds a single self-contained preview.html (wasm embedded) you can open or share
em++ core/src/sim.cpp core/bindings/wasm.cpp -I core/include -std=c++17 -O3 --bind \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createPirunCore -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 -sFILESYSTEM=0 -sSINGLE_FILE=1 -o /tmp/pirun_core_single.js
node scripts/build-preview.mjs /tmp/pirun_core_single.js preview.html
```

## Deploy without Emscripten (prebuilt artifacts)

The repo commits a **self-contained build** so it runs on any Node host with no
C++/Emscripten toolchain:

- `public/` — the full web build. The C++ core here is compiled with
  `SINGLE_FILE=1`, so the wasm is embedded as base64 inside the JS (no separate
  binary). Everything is plain text.
- `server/pirun_core_node.js` — the single-file node core the leaderboard uses
  to re-simulate runs.

So on a fresh host you can simply:

```bash
npm install     # express only
npm start       # http://localhost:3000 — no build step, no emcc
```

> Host settings: **Build command = _(none)_**, **Start command = `npm start`**,
> env `PI_API_KEY`. (Render/Railway/Replit/Fly all work.)

Contributors with the pinned Emscripten (**6.0.8**) can regenerate these
committed artifacts with:

```bash
npm run build:dist    # requires emcc 6.0.8 exactly; rewrites public/core + server/pirun_core_node.js
```

The output is byte-reproducible: CI (`.github/workflows/ci.yml`) installs
Emscripten 6.0.8 + CMake on every push/PR, runs `npm run build` and
`npm run build:dist`, and then `git diff --exit-code` on the WASM artifacts — a
stale committed core fails the build. `npm run build:frontend` (no emcc) keeps
the transpiled `public/*.js` in sync separately.

## How to play

| Action | Keyboard | Touch |
|--------|----------|-------|
| Switch lane | ← / → or A / D | swipe or tap a screen half |
| Jump (clear low hurdles) | ↑ / W / Space | swipe up |
| Slide (under overhead bars) | ↓ / S | swipe down |
| Pause | Esc / P | pause button |

Collect **π** to build combo → multiplier (up to **x6**). Power-ups: 🛡 shield ·
🧲 magnet · » boost (2× points) · ◷ slow-mo. Missions refresh daily; the **Daily
Run** uses a shared seed so everyone plays the same layout.

## Node Challenge (SoloHost)

The **NODE CHALLENGE** button on the menu starts a run whose score your own
SoloHost node verifies by re-simulating it. See
[`NODE_CHALLENGE.md`](./NODE_CHALLENGE.md) for the full design and threat model.

```
GET  /api/challenge/current       { challenge: { id, type, seed, startsAt, endsAt, rulesVersion } }
POST /api/challenge/start         { run: { runId, challengeId, seed, issuedAt, expiresAt, ... } }
POST /api/challenge/submit        { runId, challengeId, seed, simulationVersion, tapeVersion,
                                    steps, tapeSteps[], tapeCmds[], claimed:{score,distance,coins},
                                    accessToken? | localName? }
                                  → { ok, verified, result?, rank?, reason? }
GET  /api/challenge/leaderboard   ?challengeId=…&limit=…   VERIFIED runs only
GET  /api/challenge/me            ?challengeId=…&uid=…|name=…
GET  /api/node/status             local node dashboard data
GET  /api/health                  liveness + version surface (Docker healthcheck)
```

Local-first: with **no `PI_API_KEY`**, the game, Node Challenge, replay
verification, the challenge leaderboard, the node dashboard, and local
persistence all work. Pi login / payments degrade to a friendly notice. Set
`PI_API_KEY` to bind submissions to a verified Pi identity; add
`NODE_CHALLENGE_DEMO=1` to still allow local identities for demos.

### SoloHost quick start

```bash
git checkout solohost/pi-runner
docker compose -f docker-compose.solohost.yml up -d --build   # localhost:3000, non-root, read-only rootfs
curl http://127.0.0.1:3000/api/health
```

Container hardening: non-root (`node`), `read_only` rootfs + `/tmp` tmpfs,
`cap_drop: ALL`, `no-new-privileges`, `init: true`, localhost-only port, one
`/data` volume, `/api/health` healthcheck, graceful SIGTERM (flushes the store).
The image ships the committed browser + WASM artifacts — **no Emscripten at
install time**.

## Pi integration & feature flags — `web/src/config.ts`

```ts
PI_AUTH_ENABLED:     true   // Pi login inside the Pi Browser (safe everywhere)
PI_PAYMENTS_ENABLED: false  // optional cosmetic payment — OFF until sandbox-verified
PI_SANDBOX:          true   // use Pi testnet during development
LEADERBOARD_ENABLED: true   // submit runs (server re-simulates to validate)
PI_ADS_ENABLED:      false  // rewarded ads ("watch ad to revive") — needs Pi Ad Network approval
REWARDS_ENABLED:     false  // real-π play-to-earn payouts — needs Pi approval + funded app wallet
```

## Play-to-earn (Pi Ad Network + A2U rewards)

Two earn mechanisms, both **off by default** and both **cheat-resistant**:

- **Rewarded ads** — "Watch ad to REVIVE" on game-over. The client calls
  `Pi.Ads.showAd("rewarded")`; the server verifies the `adId` via
  `GET /ads_network/status/:adId` and grants the perk only when Pi acks it.
- **Real-π rewards (A2U)** — "Claim π" converts a run into a Pi payout. The
  backend **re-simulates the run** (a faked score earns nothing), enforces a
  **per-user daily cap** and **idempotency**, then pays from the app wallet via
  Pi's `pi-backend` SDK. Economics are env-tunable (`REWARD_PI_PER_TOKEN`,
  `REWARD_DAILY_CAP_PI`, `REWARD_MIN_CLAIM_PI`). Without a configured wallet,
  claims are safely recorded as *pending* — nothing is minted.

Server endpoints: `POST /api/ads/verify`, `POST /api/rewards/claim`,
`GET /api/rewards/status`. Anti-abuse is tested in `tests/rewards.test.mjs`.

**Full step-by-step launch (registration, approvals, wallet, mainnet) →
[`PI_LAUNCH.md`](./PI_LAUNCH.md).** Privacy Policy and Terms (required for Pi's
app review) are in [`PRIVACY.md`](./PRIVACY.md) and [`TERMS.md`](./TERMS.md).

- **Payments are cosmetic only and never pay-to-win** — the single optional 1 π
  unlock grants the *Gold Orb* skin + one shield per run. The game is 100% free.
- **Payments stay behind `PI_PAYMENTS_ENABLED` until** the full auth → server
  approve → complete → cancel/error flow is verified in the Pi sandbox.
- **No ads.** **No client-trusted money or scores.** The `PI_API_KEY` lives only
  on the server; the client never sees it.

### Publishing to the Pi ecosystem (you do these — they need your Pi account)

1. In the **Pi Browser**, open `pi://develop.pinet.com`, register the app, set
   its URL to your deployed URL, and enable **Sandbox**.
2. Copy the app's **API key** → set it as the `PI_API_KEY` env var on your host
   (see `.env.example`). Replace `web/validation-key.txt` with the portal's
   domain-validation key; it is served at the site root by the build.
3. Deploy (any Node host: Render, Railway, Replit, Fly, a VM…). Build command
   `npm run build`, start `npm start`, env `PI_API_KEY`.
4. Open the deployed URL in the Pi Browser sandbox, test **Login with Pi**, then
   flip `PI_PAYMENTS_ENABLED` to test the cosmetic unlock.
5. For real π, request **Mainnet payment access** in the portal, then set
   `PI_SANDBOX: false`.

See **PRODUCTION_READINESS.md** for the full status report, test evidence, and
remaining risks.

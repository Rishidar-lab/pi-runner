# Pi Runner on Pi SoloHost

Pi Runner is a SoloHost-native game: every install is a local game server **and**
a deterministic verification node (see [`NODE_CHALLENGE.md`](./NODE_CHALLENGE.md)).

- deterministic C++17 simulation compiled to WebAssembly;
- TypeScript/browser game shell;
- Node/Express local backend;
- **Node Challenge** — a server-issued daily seed, client input tape, and
  independent server-side re-simulation; only reproduced runs are VERIFIED;
- server-side replay verification for the classic leaderboard too;
- persistent local state (one `/data` volume, schema-versioned, bounded retention);
- Pi authentication/payment integration behind feature flags, off by default.

## Local container test

```bash
git checkout solohost/pi-runner
docker compose -f docker-compose.solohost.yml up -d --build
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/challenge/current
curl http://127.0.0.1:3000/api/node/status
```

Open `http://127.0.0.1:3000` in a browser, click **NODE CHALLENGE**, and play a
complete run — the node verifies it and places it on the verified leaderboard.
Add `NODE_CHALLENGE_DEMO=1` to the environment to submit without signing in
with Pi.

Stop/remove the container without deleting persistent data:

```bash
docker compose -f docker-compose.solohost.yml down
```

Delete the local volume only when intentionally resetting all local state:

```bash
docker compose -f docker-compose.solohost.yml down -v
```

## Security/defaults

- The container runs as the unprivileged `node` user.
- `no-new-privileges`, `read_only` rootfs (+ `/tmp` tmpfs), `cap_drop: ALL`, and
  `init: true` are set in the compose definition.
- The service publishes its port on `127.0.0.1` only. Inside the container it
  binds `0.0.0.0` (needed for port mapping); override with `BIND_HOST`.
- Security headers on every response (nosniff, `SAMEORIGIN`, a tuned CSP allowing
  self + the Pi SDK + Google Fonts + `wasm-unsafe-eval`, COOP/CORP,
  Permissions-Policy). No `helmet` dependency — `express` is still the only
  runtime dependency.
- Per-endpoint in-memory rate limits on the challenge routes; bounded JSON body
  sizes; strict input-tape validation before any replay CPU is spent.
- Pi API keys and wallet secrets come only from environment variables and never
  reach the client bundle. The node's own signing secret never leaves the process.
- Pi ads and real-Pi rewards remain disabled by default. Node Challenge is not
  pay-to-win — the competitive simulation ignores cosmetics.
- `/data` is the only persistent application volume. Graceful SIGTERM flushes the
  store before exit.
- Production browser/WASM artifacts are committed, so the runtime image contains
  no Emscripten, CMake, compilers, source, or build toolchain.

## SoloHost publisher flow

SoloHost is still beta. Pi currently describes the publisher flow as open/permissionless and supports draft, unlisted and listed states. The exact package/manifest fields exposed by the current Pi Desktop publisher UI should be treated as the source of truth rather than guessed in this repository.

Recommended order:

1. Build and run the container locally.
2. Create Pi Runner as a **draft** SoloHost app.
3. Copy the exact publisher schema/required fields from Pi Desktop into the repo if Pi provides an exportable manifest format.
4. Install/run the package as **unlisted** on the developer's own Node/Desktop.
5. Verify mobile access through Pi Browser/SoloHost remote access where available.
6. Verify cold install, restart, state persistence, and uninstall/reinstall behavior.
7. Publish as **listed** only after those checks pass.

## SoloHost listing material

### Name

Pi Runner

### Short description

A deterministic Pi arcade game whose SoloHost node independently replays and
verifies competitive runs.

### Long description

Pi Runner is a polished 2D endless runner whose entire game simulation —
movement, obstacles, collectibles, scoring, seeded procedural generation — is
written in deterministic C++17 and compiled to WebAssembly. The browser renders
and takes input; it is never the authority for anything that matters.

On SoloHost, every install is also a **verification node**. Each day the node
derives a shared challenge seed (HMAC over the date — the same course on every
node, with no coordination). You play the run in the Pi Browser; the client
records an input tape; your node re-simulates the run from scratch with the exact
same C++ core and computes the score itself. Only a run the node can reproduce
becomes **VERIFIED** and reaches the leaderboard. A manipulated score is rejected
with a reason code and nothing is recorded.

Everything runs locally: challenge generation, run sessions, replay verification,
the verified leaderboard, the node dashboard, and persistence all work with no
cloud and no Pi credentials. Pi login and optional cosmetic payments layer on
when configured; ads and payouts are off by default and the competitive
simulation is identical for every player.

Not claimed: this is **local** authoritative verification on one installation —
not decentralized consensus, not Pi blockchain validation. The code defines the
interfaces a future cross-node coordinator would use; it does not fake one.

### Suggested tags

`Gaming` · `Developer Tools` · `SoloHost` · `WebAssembly` · `Pi Browser`

### Why it belongs in SoloHost

Pi Runner is not merely a static web game placed in a container. The local Node instance acts as the player's own game server and verifier. Runs are generated deterministically and can be re-simulated by the backend from their seed and input tape, allowing the host to reject manipulated scores without trusting the browser client.

That makes the SoloHost version useful as a demonstration of local-first gaming infrastructure:

- local compute rather than cloud-only game logic;
- local persistent player/server state;
- deterministic verification;
- optional Pi identity and payments;
- phone-friendly UI through the Pi ecosystem;
- no advertising or reward dependency required for the core game.

## Recognition strategy

A directory listing is not the same as being featured by Pi. Optimize for actual utility and technical differentiation rather than claiming official endorsement.

Strong launch story:

> "A Pi game whose rules are executed in deterministic C++/WASM and whose Node-hosted backend replays runs to verify scores. SoloHost turns each participating computer into its own contained Pi Runner game server."

Recommended demo evidence:

1. one-click SoloHost install;
2. Pi Runner opens from Pi Desktop/Pi Browser;
3. complete a run on mobile;
4. submit the run;
5. show backend verification accepting the genuine replay;
6. demonstrate a tampered score being rejected;
7. restart the container and show persistent state;
8. show that Pi credentials remain server-side and rewards/payments are disabled by default.

## Node Challenge — shipped

The **Node Challenge** milestone is implemented on this branch: each install
generates a shared daily deterministic seed, issues server-side run sessions,
verifies runs by independent re-simulation, and keeps a VERIFIED-only
leaderboard. `server/challenge/coordinator.js` defines the
`ChallengeCoordinator` / `NodeFederationAdapter` interfaces a future global
coordinator would implement; the node already signs run tokens with its own key.
See [`NODE_CHALLENGE.md`](./NODE_CHALLENGE.md).

The release toolchain is pinned to **Emscripten 6.0.8**; the committed WASM
cores rebuild byte-for-byte and CI (`wasm-build`) rejects a stale artifact via
`git diff --exit-code` after a fresh `build:dist`.

### Beyond this milestone

- A `PiNetworkChallengeCoordinator` that pushes node-signed VERIFIED results to a
  shared coordinator for cross-node aggregation — once such a coordinator exists.
- Anomaly checks for legitimately-played but automated runs.

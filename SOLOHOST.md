# Pi Runner on Pi SoloHost

Pi Runner is a strong SoloHost candidate because it is already a self-contained local web service:

- deterministic C++17 simulation compiled to WebAssembly;
- TypeScript/browser game shell;
- Node/Express local backend;
- server-side replay verification for leaderboard submissions;
- persistent local state;
- Pi authentication/payment integration behind feature flags.

## Local container test

```bash
git checkout solohost/pi-runner
docker compose -f docker-compose.solohost.yml build
docker compose -f docker-compose.solohost.yml up -d
curl http://127.0.0.1:3000/api/rewards/status
```

Open `http://127.0.0.1:3000` in a browser and play a complete run.

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
- `no-new-privileges` is enabled in the compose definition.
- The service binds to `127.0.0.1` rather than all interfaces.
- Pi API keys and wallet secrets are provided only through environment variables.
- Pi ads and real-Pi rewards remain disabled by default.
- `/data` is the only persistent application volume.
- Production browser/WASM artifacts are already committed, so the runtime image does not contain Emscripten, CMake, compilers, source code, or the build toolchain.

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

## Positioning

### Name
Pi Runner — Deterministic Arcade Node Game

### Short description
A locally hosted Pi arcade runner with a deterministic WebAssembly game core, verified replays, daily seeded runs and Pi-native identity.

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

## Next SoloHost-native milestone

Add a **Node Challenge** mode: each local Pi Runner instance generates a shared daily deterministic seed, verifies local runs itself, and can optionally submit signed/verified results to a future global coordinator. This gives SoloHost a real gameplay role rather than using it only as a packaging mechanism.

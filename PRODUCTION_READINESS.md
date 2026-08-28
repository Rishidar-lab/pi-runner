# Pi Runner — Production Readiness Report

_Rebuild of `Rishidar-lab/pi-runner` from a single-file JS MVP into a layered,
tested, C++/WASM-core endless runner._

---

## 1. What the original repo actually was (audit)

The repository contained **no C++**. It was a ~19 KB single-file HTML5 canvas
game (`public/app.js`) plus a small Express server. The referenced "model" was
the JS `Game` object: a 3-lane dodge-and-collect MVP with player `{lane,x,y}`,
red-block obstacles, π coins, one shield, a passive/coin score, and a
`localStorage` best. Pi auth + a 1 π unlock payment (approve/complete) worked but
the store was in-memory, everything lived in one file, and scores were fully
client-trusted.

**Decision (confirmed with the owner):** keep the good ideas, rebuild the core in
**C++ → WebAssembly** with a **TypeScript** shell and a hardened Node backend.

## 2. What was built

| Area | Status | Notes |
|------|--------|-------|
| Deterministic C++ core | ✅ | `xoshiro256**` RNG, fixed 120 Hz step, seeded procedural spawns guaranteed solvable. |
| Movement: lanes + jump + slide | ✅ | Obstacle types (barrier / low-hurdle / overhead) require dodge / jump / slide respectively. |
| Scoring: distance, coin, combo, multiplier (→x6), gems | ✅ | Integer-exact, deterministic. |
| Power-ups: shield, magnet, boost (2×), slow-mo | ✅ | Rate-limited spawns. |
| Missions (daily), achievements, daily challenge, skins | ✅ | Skins cosmetic only; unlocks from lifetime totals + optional Pi cosmetic. |
| Screens: menu, tutorial, pause, settings, sound, game-over, skins, missions | ✅ | Built in `ui/ui.ts`. |
| Local save + cloud-ready abstraction | ✅ | Profile serialized **and checksum-guarded in C++**; tampered saves rejected. |
| Rendering (2.5D perspective road, particles, parallax, shake) | ✅ | Canvas 2D; reduced-motion setting honored. |
| Input: keyboard + touch swipe/tap + on-screen buttons | ✅ | `input/input.ts`. |
| Audio: procedural SFX + music (no asset files) | ✅ | Web Audio; sound/music toggles. |
| Pi adapter (auth + payments), isolated + feature-flagged | ✅ | `pi/piAdapter.ts`; nothing else touches the SDK. |
| Backend: persistent store, payment idempotency, secrets server-side | ✅ | Atomic JSON store; `PI_API_KEY` never sent to client. |
| Leaderboard with anti-cheat | ✅ | Server **re-simulates** the run (seed + input tape) with the same C++ core and rejects score mismatches. |
| Build system | ✅ | `emcc` for WASM; Node's built-in TS transform for the web bundle (no external bundler dependency). |
| Tests | ✅ | 44 native C++ assertions + 4 backend JS tests. |
| README + env config + `.gitignore` | ✅ | Full build/run/publish instructions. |

## 3. Tests performed

**Native C++ core — `npm run test:core` → PASSED 44 / FAILED 0**
- RNG determinism (same seed identical, different seed differs, bounds).
- Save profile round-trip + **tamper rejection** (bad checksum / malformed → reset).
- State transitions (menu→playing→paused→resume→game-over→restart).
- Collisions: lane dodge, jump clears low hurdle, grounded-into-hurdle hits,
  slide clears overhead, jump into overhead hits, shield absorbs then next hit ends.
- Scoring: coin/gem values, same-lane vs missed, combo → multiplier tiering,
  combo reset on hit, boost doubling.
- Power-ups: magnet pulls adjacent-lane coin; slow-mo reduces distance.
- **Determinism / anti-cheat:** live `advance()` playthrough score == headless
  `verifyRun()` score.

**Backend — `npm run test:js` → 4 / 4 passed**
- Payment state machine created→approved→completed grants unlock.
- Unlock idempotency.
- Leaderboard verifier rejects malformed submissions.
- Leaderboard verifier **accepts a genuine run and rejects an inflated score**.

**End-to-end (live)** — server booted; verified: static hosting (200), unlock
status, `POST /api/score` accepts a genuine run (verified), rejects a `+1,000,000`
cheat (`score mismatch`, server recomputed the true value), leaderboard returns
the verified entry.

**Browser (real Chromium, public URL)** — menu renders; **a run plays**: the
perspective lane road, player orb, red barriers, π coins, boost + shield pickups,
live HUD (score/coins/multiplier) and on-screen controls all function. WASM core
loads and the fixed-step loop runs at frame rate.

## 4. Verify-it-yourself commands

```bash
npm install
npm run build          # build:wasm (needs emcc) + build:web
npm test               # 44 C++ + 4 JS
npm start              # http://localhost:3000  — play in any browser
```

## 5. Remaining risks / explicitly out of scope

- **Pi login & payments require the Pi Browser + your Pi account.** They could
  not be exercised in this environment (no account creation on your behalf). The
  code paths are complete and server-verified; **verify in the Pi sandbox before
  going live**, then flip `PI_PAYMENTS_ENABLED`.
- **`PI_PAYMENTS_ENABLED` ships `false` by design.** Turn on only after the
  sandbox approve→complete→cancel/error flow is confirmed. For real π, request
  Mainnet access and set `PI_SANDBOX:false`.
- **Leaderboard store is a JSON file** (atomic writes). Fine for launch/MVP; move
  to a real DB + auth-scoped writes for scale. The `SaveBackend`/store interfaces
  are intentionally small to make that swap easy.
- **Anti-cheat scope:** re-simulation blocks fabricated/inflated scores. A
  determined attacker could still automate *legitimate* play; add per-account
  rate limits / anomaly checks if abuse appears.
- **Leaderboard ranking / "top of the Pi AI leaderboard"** depends on real user
  adoption and Pi's own ranking criteria — outside the code. This build gives you
  a fast, distinctive, verifiable, review-friendly app to compete with.
- **Build requires Node ≥ 22.6 and Emscripten.** Prebuilt `public/` + committed
  WASM can be shipped if a host lacks `emcc`.

## 6. Suggested next steps

1. Register the app in the Pi Developer Portal and wire `PI_API_KEY` + the
   domain-validation key; deploy to a Node host.
2. Sandbox-test Pi login and the cosmetic unlock; enable `PI_PAYMENTS_ENABLED`.
3. Add a leaderboard UI screen (backend + validation already exist) and a DB.
4. Playtest and balance via the constants in `core/include/pirun/pirun.hpp` (`cfg`).

# PI RUNNER — CLOSEOUT (2026-10-18 re-verification)

**Date:** 2026-10-18 · **Supervisor:** Claude Code (Opus 4.8) · **Host:** Kali `/home/rishidar`
**Verdict:** `READY_FOR_EXTERNAL_VALIDATION` — local engineering green and re-verified; **payments OFF**; external A–H gates genuinely blocked on a Pi Browser + account + HTTPS + human (not faked).

Extends `PI_RUNNER_FINAL_CLOSEOUT.md` (2026-10-07). Confirmed against live runs today.

---

## 1. Repository truth (inspected, not assumed)
```
Branch: solohost/pi-runner   HEAD: ad9bf61   Working tree: clean
```
The historical `82ee5d9` is now the **second** commit; `ad9bf61` (the prior closeout doc) is the only commit on top — so the code under test is byte-identical to what `82ee5d9` verified. `git log`: `ad9bf61` docs(closeout) ← `82ee5d9` security(payments) server-side gate + 30 adversarial tests.

## 2. Local gates (run live 2026-10-18)
| Gate | Command | Result |
|---|---|---|
| JS tests | `npm run test:js` | **99 passed, 0 failed** (10.1s) |
| Adversarial/challenge | `npm run test:challenge` | **44 passed, 0 failed** (1.5s) |
| Typecheck | `npm run typecheck` (`tsc -p web/tsconfig.json --noEmit`) | **exit 0, no errors** |
| Native C++ core | `npm run test:core` | **CANNOT RUN — `cmake` absent** (also needs Emscripten 6.0.8); pre-built core artifacts are git-tracked so the server runs, but the C++ sources are not re-compiled/re-asserted here |

`test:core` is a named gap, not glossed. It is unchanged from the prior closeout (host still lacks cmake + emcc).

## 3. Payments — OFF, verified in code + environment (not enabled)
Two independent server-side gates in `server/server.js`:
- `PI_API_KEY` unset → `500` "PI_API_KEY is not set …" (login/payments disabled).
- `paymentsEnabled() = truthy(PI_PAYMENTS_ENABLED)` — **default OFF** → `503 {reason: payments_disabled}`.
- `mainnetAllowed() = truthy(PI_ALLOW_MAINNET)` — on mainnet a **second** explicit flag is required → else `503 {reason: mainnet_disabled}`; forgetting `PI_NETWORK` fails closed on mainnet.

Defaults ship safe: `.env.example` → `PI_NETWORK=testnet`, `PI_PAYMENTS_ENABLED=0`, `PI_ALLOW_MAINNET=0`; client `public/config.js` → `PI_PAYMENTS_ENABLED:false`. On this host **no `PI_*` env var is set** (`env | grep ^PI_` empty), so payments cannot fire and no real-value path is reachable. The 30 route-level adversarial payment tests (amount/network/duplicate/callback/retry/entitlement-once) are inside the 44 passing challenge tests. **This run did not enable payments and must not be read as approving that.**

## 4. A–H gates — BLOCKED_EXTERNAL (the project's own definition, honoured)
`docs/TESTNET.md` §1 defines A–H as an 8-item **manual** checklist requiring a Pi Browser, a registered Testnet app, an HTTPS app URL, a Server API key, and human interaction:

| Gate | Name | Class |
|---|---|---|
| A | Auth (Login with Pi) | `BLOCKED_EXTERNAL` |
| B | Product unlock shows 1 π | `BLOCKED_EXTERNAL` |
| C | Payment binding (amount/memo/payer/Testnet) | `BLOCKED_EXTERNAL` |
| D | Approval server-validates amount/memo/buyer/network | `BLOCKED_EXTERNAL` |
| E | Entitlement granted exactly once | `BLOCKED_EXTERNAL` |
| F | Interruption → `onIncompletePaymentFound` recovers | `BLOCKED_EXTERNAL` |
| G | Cancel/failure grants nothing | `BLOCKED_EXTERNAL` |
| H | Duplicate callbacks idempotent | `BLOCKED_EXTERNAL` |

None can be completed locally. `docs/TESTNET.md:77`: *"I will not mark A–H verified based on mocks or code inspection alone."* This run honours that — the validation **logic** those gates exercise has adversarial unit coverage (§2–3), which is **not** the same as passing a live gate, and is not reported as such.

## 5. Prepared and waiting (no external account needed)
SDK auth wired, server-side validation implemented, product catalog server-authoritative, feature flags dark, `.env.example` complete + git-ignored, env loader present. The only missing local prerequisite for A–H is an HTTPS endpoint (`tailscale serve 3000` would mint one on the authenticated tailnet, **no purchase**) — an owner decision; **not executed** (publishing a reachable endpoint is outward-facing).

## 6. Owner actions (unchanged)
1. Mint HTTPS on the tailnet. 2. Register a Testnet app in Pi Browser; put the Server API key in `~/pi-runner/.env` (never chat/commit); keep `PI_ALLOW_MAINNET=0`. 3. Run A–H from `docs/TESTNET.md` on Testnet only. Optionally install cmake + Emscripten 6.0.8 to re-prove `test:core`.

## 7. Verdict
```
VERDICT = READY_FOR_EXTERNAL_VALIDATION
PAYMENTS_ENABLED = false (default-off gate + no PI_* env)
LOCAL_GATES = test:js 99/99, test:challenge 44/44, typecheck clean
LOCAL_GATE_UNRUNNABLE = test:core (cmake + emscripten absent)
EXTERNAL_GATES = A-H all BLOCKED_EXTERNAL (Pi Browser + account + HTTPS + human)
```
No changes made to pi-runner code this run (verification only); working tree clean. **Scope:** nothing under `/home/parzival`; no push; no payment experimentation.

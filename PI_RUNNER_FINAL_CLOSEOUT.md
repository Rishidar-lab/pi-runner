# PI RUNNER — FINAL CLOSEOUT

**Date:** 2026-10-07 · **Machine:** Kali laptop (`Rishidar`)
**Verdict:** `READY_FOR_EXTERNAL_VALIDATION`
**Payments: OFF, and proven off by live probe, not by inspection.**

---

## 1. Repository truth

```
Path:              /home/rishidar/pi-runner
Remote:            https://github.com/Rishidar-lab/pi-runner.git
Branch:            solohost/pi-runner
HEAD:              82ee5d9c161f4e640bf05650354ca9f442400e06
Ahead/behind:      0 ahead / 4 behind origin
Working tree:      clean
Version:           2.1.0
```

HEAD matches the previously observed `82ee5d9`. The branch is **4 commits behind
origin** — recorded, not acted on: no fetch, pull, or push was performed in this
run.

## 2. Tests — all documented gates run

| Gate | Command | Result |
|---|---|---|
| JS tests | `npm run test:js` | **99 passed, 0 failed** (13.8 s) |
| Adversarial/challenge | `npm run test:challenge` | **44 passed, 0 failed** (1.7 s) |
| Typecheck | `npm run typecheck` | **exit 0** (`tsc --noEmit`, clean) |
| Native C++ core | `npm run test:core` | **CANNOT RUN** — `cmake` NOT_INSTALLED |

The 99-test count matches the previously observed figure, and the 30
route-level adversarial payment tests are a subset of that suite (verified
individually, see section 3).

**`test:core` is a genuine gap, named rather than glossed:** it requires `cmake`
and Emscripten 6.0.8, and **neither is installed on this machine**
(`cmake` absent, `emcc`/`em++` absent). The pre-built core artifacts are present
and git-tracked (`public/core/pirun_core.js` 85 KB, `server/pirun_core_node.js`
86 KB — Emscripten asm.js output, not raw `.wasm`), so the server-side
re-simulation and anti-cheat work without a rebuild. What cannot be verified here
is that the C++ sources still compile, or that the native test assertions still
pass. `PRODUCTION_READINESS.md` records a historical "44/44 native passed" run;
**that result is not reproduced or re-verified by this run.**

## 3. Payment-security invariants — verified live, not read

Two independent server-side gates exist (`server/server.js:141-155`). Each was
probed against a real running server in this session:

| Scenario | Endpoint | Observed |
|---|---|---|
| **A** — no env at all | `/api/approve` | **500** `PI_API_KEY is not set…` (fails closed; server log shows `"piApiKey":"absent"`) |
| **A** — no env at all | `/api/complete` | **500** same |
| **B** — dummy key, `PI_PAYMENTS_ENABLED` unset | `/api/approve` | **503** `{"reason":"payments_disabled"}` |
| **B** — dummy key, `PI_PAYMENTS_ENABLED` unset | `/api/complete` | **503** `{"reason":"payments_disabled"}` |
| **C** — `PI_NETWORK=mainnet`, `PI_PAYMENTS_ENABLED=1`, `PI_ALLOW_MAINNET` unset | `/api/approve` | **503** `{"reason":"mainnet_disabled"}` |

The key used in B and C is the literal placeholder string `dummy-not-a-real-key`.
**No real credential was created, used, or exposed.** No `.env` file exists in the
repo; zero `PI_*` environment variables are set on this machine. No server was
left running (`:3000-3009` all free).

Invariant-by-invariant:

| Invariant | Status | Evidence |
|---|---|---|
| Payments disabled by default | **VERIFIED** | live 503; test 19 |
| No seed storage | **VERIFIED** | no mnemonic/seed code path in `server/`; `PRIVACY.md:37` states the passphrase is never requested; `docs/BALANCE_ACTIONS.md:268` warns against sharing it |
| No private-key collection | **VERIFIED** | `server/` handles only Pi's Server API key, which is not a wallet key; no keypair generation anywhere |
| No custodial assumption | **VERIFIED** | `docs/SOURCES.md:83` records Pi's noncustodial model as a design constraint; entitlement is granted on verified settlement, not on key custody |
| Amount validation | **VERIFIED** | underpay 0.001 → 409, overpay 2 → 409, **and** underpay-with-verified-tx still rejected at complete (test 25) |
| Network validation | **VERIFIED** | wrong-network → 409 `wrong_network` (test 10); mainnet → 503 at the gate |
| Duplicate transaction protection | **VERIFIED** | replay idempotent (16), concurrent duplicates safe (17), entitlement granted exactly once (23), single grant on reconcile (29) |
| Callback validation | **VERIFIED** | missing token 401, fake token 401, **client body uid ignored** (24), missing txid → 409 and never sent to Pi (22) |
| Retry handling | **VERIFIED** | interrupted payment recovery via `onIncompletePaymentFound`; server re-fetches state; already-`developer_completed` reconciled idempotently (29) |
| Explicit user confirmation | **VERIFIED** | Pi's own approve→sign→complete flow; goods delivered only after `/complete` returns non-error (`docs/SOURCES.md:161`) |

**Payments remain OFF. This run did not enable them and must not be read as
approving that.**

## 4. Secure exposure — the local half is ready, the decision is not mine

```
tailscale: rishidar.tail9a2b37.ts.net   BackendState=Running (authenticated tailnet)
serve config: NONE  ->  no HTTPS endpoint exists
MagicDNS suffix: tail9a2b37.ts.net
certbot: NOT_INSTALLED    acme.sh: NOT_INSTALLED
pi-runner :3000          NOT LISTENING
```

`docs/TESTNET.md` step 2 states the Pi SDK will not initialize over plain HTTP, so
HTTPS is a hard prerequisite for the gates. Because this tailnet is already
authenticated and running, `tailscale serve 3000` would mint a real certificate
for `https://rishidar.tail9a2b37.ts.net` **without purchasing any infrastructure**.

**Not executed.** Enabling `serve` publishes a reachable HTTPS endpoint; that is an
owner decision, and this run bought nothing and published nothing. `gcloud` is
present but was not used.

## 5. A–H gates — the project's actual definition

I searched the repository rather than assuming. The real definition is
`docs/TESTNET.md` §1, an 8-item manual checklist requiring a Pi Browser and a
Pi account:

| Gate | Name | Class |
|---|---|---|
| A | Auth — "Login with Pi" returns your username | `BLOCKED_EXTERNAL` |
| B | Product — unlock shows 1 π from the server catalog | `BLOCKED_EXTERNAL` |
| C | Payment binding — dialog shows 1 π, correct memo, you as payer, Testnet | `BLOCKED_EXTERNAL` |
| D | Approval — server validates amount/memo/buyer/network (wrong amount → 409) | `BLOCKED_EXTERNAL` |
| E | Entitlement — granted exactly once, no double-grant on reload | `BLOCKED_EXTERNAL` |
| F | Interruption — close mid-flow, `onIncompletePaymentFound` recovers | `BLOCKED_EXTERNAL` |
| G | Cancel/failure — cancel grants nothing | `BLOCKED_EXTERNAL` |
| H | Duplicate callbacks — double-tap complete is idempotent | `BLOCKED_EXTERNAL` |

All eight require: Pi Browser, a registered Testnet app, an HTTPS app URL, a
Server API key, and human interaction. **None can be completed locally.**
`docs/TESTNET.md:77` states the author's own position: *"I will not mark A–H
verified based on mocks or code inspection alone."* This run honours that.

The closest local evidence — and it is **not** the same thing as passing a gate —
is that the validation logic those gates exercise has adversarial unit coverage
(30 route-level tests). `artifacts/release-candidate/testnet-A-H-results.md`
exists in the repo but was **not** used as evidence here, since no A–H result can
be produced without the external account.

## 6. What is prepared and waiting

Steps 1, 3, 4b and 5 of `docs/TESTNET.md` need no account and are code-complete:
SDK auth wired, server-side validation implemented, product catalog
server-authoritative (`server/products.js`), feature flags dark in
`web/src/config.ts`, `.env.example` complete and git-ignored, env loader present
(`server/env.js`). The only missing local step is HTTPS (section 4).

## 7. Verdict

```
VERDICT = READY_FOR_EXTERNAL_VALIDATION

PAYMENTS_ENABLED = false   (proven by live 503 probe, two independent gates)
LOCAL_GATES_PASSED = test:js 99/99, test:challenge 44/44, typecheck clean
LOCAL_GATE_UNRUNNABLE = test:core (cmake + emscripten 6.0.8 not installed)
EXTERNAL_GATES = A-H all BLOCKED_EXTERNAL (Pi Browser + account + HTTPS + human)
```

Local engineering is complete and verified. Production readiness is **not**
claimed and would be a false statement: it depends on eight gates nobody has run,
plus one locally-blocked native test gate.

## 8. Owner actions

1. **Mint HTTPS on the tailnet** — `tailscale serve 3000` in `~/pi-runner`, or a
   real host. This is the only local prerequisite left for A–H. No purchase needed.
2. **Register a Testnet app** in Pi Browser (`pi://develop.pinet.com`, network
   Testnet — immutable), put the Server API key in `~/pi-runner/.env` (never chat,
   never commit), and leave `PI_ALLOW_MAINNET=0`.
3. **Run A–H in order** from `docs/TESTNET.md`. Keep `PI_PAYMENTS_ENABLED=1` for
   the testnet run only. Do not flip `PI_ALLOW_MAINNET` — Testnet is the safe path
   and this project should stay there until you deliberately choose otherwise.

Separately, if a CI-grade re-validation is wanted, install `cmake` and
Emscripten 6.0.8 so `npm run test:core` can be re-proven rather than inherited
from a prior run.

## 9. Evidence

```
logs/pi_runner_challenge.txt            44/44 challenge tests
logs/pi_runner_typecheck.txt            tsc clean
logs/pi_runner_payments_off.txt         live 503 probes, three scenarios
logs/pi_runner_exposure.txt             :3000 not listening, no serve config
logs/pi_runner_https_capability.txt     tailnet capability, nothing purchased
```

### Commits created

None. This phase made **no changes to pi-runner** — verification only. The
working tree is clean and matches `82ee5d9`.

### Server-side note

`server/data/store.json` is git-ignored and holds local runtime state (4 scores
from earlier local runs, the node identity). It was touched by the probe servers
but contains no secrets and no payment records. Not committed.

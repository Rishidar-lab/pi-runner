# Security Regression Summary — Payment Fix Verification

_Host: Kali laptop (Rishidar). Commit: see release-metadata.json._

## Invariant proven
**The client never determines whether a payment is sufficient.** Every
authoritative field (amount, memo, buyer, network, direction, product, status,
txid) is validated by the server against `server/products.js` and against the
Pi-verified `uid`, using the Pi PaymentDTO re-fetched from Pi — never client input.

## Automated evidence
- `tests/payment-state.test.mjs` — pure `validatePaymentForProduct` + store idempotency.
- `tests/payment-routes.test.mjs` — 30 route-level adversarial tests against the
  real Express app with a mocked Pi API. All pass.

## Adversarial cases covered (route level)
| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Correct product + correct amount (testnet) | 200 approved | PASS |
| 2 | Underpay (0.001) | 409 amount_mismatch | PASS |
| 3 | Overpay (2) | 409 amount_mismatch | PASS |
| 4 | Wrong memo | 409 memo_mismatch | PASS |
| 5 | Wrong buyer (uid != token) | 409 payment_owner_mismatch | PASS |
| 6 | Wrong network (mainnet on testnet host) | 409 wrong_network | PASS |
| 7 | Unexpected direction (A2U) | 409 wrong_direction | PASS |
| 8 | Nonexistent product | 409 unknown_product | PASS |
| 9 | Arbitrary paymentId Pi can't find | 404 | PASS |
| 10 | Cancelled payment | 409 payment_cancelled | PASS |
| 11 | Malformed PaymentDTO (empty) | 409 (rejected) | PASS |
| 12 | Missing access token | 401 | PASS |
| 13 | Fake access token (Pi /me rejects) | 401 | PASS |
| 14 | Client body uid differs from token /me | body uid ignored; grant binds to token uid | PASS |
| 15 | Approval replay | 200 idempotent | PASS |
| 16 | Concurrent duplicate approvals | both 200, no error | PASS |
| 17 | Missing PI_API_KEY | 500 fail-closed | PASS |
| 18 | Payments disabled (default) | 503 payments_disabled | PASS |
| 19 | Mainnet without PI_ALLOW_MAINNET | 503 mainnet_disabled | PASS |
| 20 | Complete: tx not verified | 409 tx_not_ready (no entitlement) | PASS |
| 21 | Complete: missing/undefined txid | 409 tx_not_ready | PASS |
| 22 | Complete: verified tx grants once + replay idempotent | single grant | PASS |
| 23 | Complete: underpaid but tx-verified | 409 amount_mismatch | PASS |
| 24 | Complete: buyer mismatch on verified tx | 409 payment_owner_mismatch | PASS |
| 25 | Complete: Pi complete fails | error, NO entitlement | PASS |
| 26 | Complete: Pi already developer_completed | reconciled idempotently, single grant | PASS |
| 27 | Complete: cancelled payment | 409, no entitlement | PASS |

## Config-safety hardening added this session
- Server-side `PI_PAYMENTS_ENABLED` (default OFF) gates `/api/approve` + `/api/complete`.
- Server-side `PI_ALLOW_MAINNET` (default OFF) — Mainnet refused even with a key + `PI_NETWORK=mainnet`.
- `.env.example` default switched to `PI_NETWORK=testnet` (safe path for this phase).

## Secrets hygiene
- Startup log shows `piApiKey:"absent"` / `"set"` — never the value.
- Payment rejection logs carry only `{route, reason, productId}` — no tokens/keys.
- No secrets in frontend bundles (client only ever sends the user access token it already holds).

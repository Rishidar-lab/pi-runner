# Testnet A–H Results

Status legend: NOT VERIFIED = requires operator Pi Browser action (not done yet).
Server-side logic for each item is pre-validated by automated tests.

| ID | Item | Automation class | Server logic proven (automated) | Pi Browser verified |
|----|------|------------------|-------------------------------|---------------------|
| A | Authentication (Login with Pi → username) | PI-BROWSER-MANUAL | `/api/me` token verify path exercised via mock | NOT VERIFIED |
| B | Product price (Gold Orb = 1 π from server catalog) | PARTIALLY AUTOMATABLE | `GET /api/products` → `{gold_shield_unlock_v1:{amount:1}}` (automated ✓) | NOT VERIFIED (UI display) |
| C | Payment binding (dialog: 1 π, memo, payer, testnet) | PI-BROWSER-MANUAL | validation binds all fields (tests 1–10) | NOT VERIFIED |
| D | Approval (validate before approve; wrong amount → 409) | PARTIALLY AUTOMATABLE | 409 rejections proven (route tests) | NOT VERIFIED (real approve) |
| E | Entitlement granted exactly once | PARTIALLY AUTOMATABLE | idempotent grant proven (tests 22,26) | NOT VERIFIED |
| F | Interruption recovery (onIncompletePaymentFound → re-fetch) | PARTIALLY AUTOMATABLE | complete-path re-fetch + tx gating proven (tests 20–22) | NOT VERIFIED |
| G | Cancel/failure → no entitlement | PARTIALLY AUTOMATABLE | cancelled/failed → no grant proven (tests 25,27) | NOT VERIFIED |
| H | Duplicate callbacks → single grant | PARTIALLY AUTOMATABLE | replay idempotency proven (tests 15,22) | NOT VERIFIED |

**Overall: A–H NOT YET VERIFIED via genuine Pi Sandbox/Testnet.** Blocked only on
operator Pi Browser actions (see OPERATOR ACTION REQUIRED in the release report).
All server-side logic behind A–H passes automated adversarial tests.

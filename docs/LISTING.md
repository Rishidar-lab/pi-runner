# Listing-Ready Package — Kurinji Run

_Prepared 2026-09-27. For review only — NOT submitted, NOT published, no approval claimed._
_Rules source: developers.minepi.com Mainnet listing criteria + minepi.com/pi-trademark-guidelines (retrieved 2026-09-27)._

## 1. Naming decision (trademark-compliant)

- **Working name: "Kurinji Run"** (குறிஞ்சி = the hills/mountains region of Tamil
  literature — distinctive, no collision found in app stores / web / PiNet as of
  2026-09-27; URL will NOT start with "pi").
- Why not "Pi Runner": the name is taken by unrelated products (a delisted
  Android platformer by mxlarscoding; itch.io/browser games), and Pi trademark
  rules allow "Pi" in an app name only with a Trademark Licensing Agreement,
  with permissible forms limited to "App_Name for Pi" / "App_Name on Pi".
- Future option, only with a licence: "Kurinji Run for Pi".
- Pi logo/brand colours: not used. π glyph used only as the in-game coin symbol
  (a mathematical constant, not Pi Network's logo).

## 2. App metadata (draft)

- **Name:** Kurinji Run
- **Tagline:** "A fast, fair, cheat-resistant runner for the Pi ecosystem."
- **Description (EN):** Kurinji Run is a free, fast-paced endless runner built
  for the Pi Browser. Switch lanes, jump hurdles, slide under bars, chain
  combos, and climb seasonal leaderboards. Every run is verified by server-side
  re-simulation — scores can't be faked. Free practice, daily challenges,
  seasonal leaderboards, Tamil + English UI, and an optional cosmetic unlock.
  Game points are not Pi. No ads without approval; no pay-to-win.
- **Description (TA):** (short Tamil version of the above — translate from the
  final en string before submission)
- **Category:** Games
- **Screenshots:** (capture after Pi sandbox deployment — see §5)
- **Privacy policy / Terms:** PRIVACY.md and TERMS.md already in repo root;
  host them on the app URL and link from the portal (required for review).
- **PiNet subdomain:** required as Mainnet checklist step 10 — budget this.

## 3. Compliance checklist against verified criteria

| Criterion (official) | Status |
|---|---|
| Fully functional app + professional UI | ✅ built; playtest pending your pass |
| Developer KYC | ⏳ yours, in the Pi app |
| URL/domain must not start with "pi" | ✅ naming plan (e.g., kurinjinrun.pinet.com or a neutral domain you own) |
| Pi Authentication SDK only | ✅ (feature-flagged; email/third-party login absent) |
| Pi-only transactions | ✅ (single optional π cosmetic; no fiat, no other tokens) |
| No redirection to external sites | ✅ |
| Minimal data collection | ✅ privacy policy in repo |
| PiNet integration (checklist step 10) | ⏳ pending your setup |
| Mainnet listing approval | ⏳ not applied |

## 4. Monetisation posture (honest)

- **Ads:** OFF. Rewarded ads require Pi Core Team approval; server-side adId
  verification is implemented (`/api/ads/verify`, reward only on
  `mediator_ack_status === "granted"`) but gated behind `PI_ADS_ENABLED=false`.
- **Cosmetic purchase:** 1 π "Gold Orb + Shield" — cosmetic + one starting
  shield only, never pay-to-win. OFF until sandbox approve→complete→cancel→error
  is verified; `PI_PAYMENTS_ENABLED=false`.
- **Play-to-earn / A2U:** OFF. Requires approval + funded app wallet + abuse
  controls; re-simulation + daily cap + idempotency implemented.
- **No NFTs, no tokens, no betting, no paid-entry prize pools** (by design).

## 5. What only you can do (submission checklist)

1. Pi Browser → `pi://develop.pinet.com` → register Testnet + Mainnet apps
   (App Network is immutable — register both from day one).
2. Set app URL → your deployed HTTPS URL; host `web/validation-key.txt` from the
   portal; Verify Domain.
3. Sandbox: `https://sandbox.minepi.com` → authorize → test Login with Pi.
4. Test the cosmetic payment in sandbox (approve → complete → cancel → error).
5. Request Incoming Multisig Wallet (U2A) for Mainnet payments (CT review).
6. Request Pi Ad Network monetisation approval (if you want ads).
7. Add PiNet subdomain (checklist step 10), attach PRIVACY.md/TERMS.md, submit
   screenshots, submit for review.

## 6. Screenshot capture plan (after sandbox deploy)

1. Menu (EN + TA) 2. Tutorial 3. Mid-run HUD 4. Node Challenge screen
5. Verified result 6. Season leaderboard 7. Game-over + replay 8. Settings (language toggle)
Capture on an Android-sized viewport (e.g., 390×844). Store under
`evidence/listing_YYYYMMDD/` with timestamps.

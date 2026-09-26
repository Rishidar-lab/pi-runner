# Economics & Experiment Design — Kurinji Run

_Date: 2026-09-27 | All figures are SCENARIOS or labelled assumptions until real
analytics exist. Nothing here is realised income._

## 1. Ledger of value flows (kept strictly separate)

| Bucket | What it is | Status |
|---|---|---|
| Mobile mining accrual | Pi mined in the official mobile app | Accrual only — not spendable until migrated + liquid |
| Node bonus observations | Possible node rewards (eligibility contradictory) | Not started; ₹0 assumed |
| Verified on-chain payments | Real π moving on Mainnet | Only the optional 1 π cosmetic (feature OFF) |
| Developer ad revenue | Pi Ad Network share | Requires Pi Core Team approval — not applied |
| Player payouts (A2U) | Real π paid to players | Disabled (`REWARDS_ENABLED=false`) — requires approval + funded wallet |
| Hosting | Deployment cost | ₹0 local (localhost/Docker); paid hosting only if chosen |
| Electricity | Node (not started) | Model in NODE_FEASIBILITY.md §6; ₹0 while node is off |
| Your time | Development + playtest | Real cost, tracked qualitatively |

## 2. Assumptions (every one uncertain)

| ID | Assumption | Value | Basis |
|---|---|---|---|
| A1 | Local hosting cost | ₹0/month | This machine; no paid host chosen |
| A2 | Node electricity | ₹303/month at 60 W, ₹7/kWh | Labelled assumption; node not running |
| A3 | Ad revenue per 1k sessions | unknown — scenario only | No published Pi Ad Network rate card |
| A4 | Cosmetic conversion | unknown — scenario only | No published ecosystem benchmark |
| A5 | Your marginal tariff | ₹7/kWh | Tamil Nadu domestic approx.; confirm your slab |

## 3. Scenario model (no forecast)

Run `scripts/scenario.mjs` (reproducible, seeded). Inputs: sessions/day,
rewarded-ad approval (yes/no), cosmetic conversion %, ad revenue per 1k
sessions, player payout cost per 1k sessions. Outputs are labelled
**SCENARIO — not a forecast**.

Included stress cases (mandatory):
- **No-ad-approval**: zero ad revenue; survival depends on A1 only (₹0 local).
- **Zero-revenue**: all monetisation off; cost = A1 (+A2 if node ever runs).
- **Weak retention**: sessions/day decays; cosmetic conversion → 0.
- **Low conversion**: cosmetic conversion 0.1%–1%.

Sensitivity: vary A3 and A4 over 10× ranges; report min/median/max.

## 4. Launch metrics (targets ≠ achievements)

| Metric | Definition | Target |
|---|---|---|
| Load time | First interactive frame p75 | < 2.5 s on mid-tier Android |
| Crash-free sessions | Sessions without uncaught error | ≥ 99% |
| Tutorial completion | Reaches first run / starters | ≥ 80% |
| Valid score submission | Server re-simulation pass rate | ≥ 95% of submissions |
| D1 / D7 retention | Return after 1 / 7 days | measured; no target claimed |
| Verified payment completion | Sandbox approve→complete success | 100% in sandbox before enable |
| Revenue & costs | Actually observed | reported as observed |

## 5. Daily tracker (template — copy to `~/kurinji-run-tracker.csv`)

```csv
date,day,active_sessions,verified_submissions,rejected_submissions,ad_impressions_verified,ad_revenue_pi,cosmetic_sales_count,cosmetic_revenue_pi,payouts_pi,hosting_cost_inr,electricity_cost_inr,notes
2026-09-27,1,0,0,0,0,0,0,0,0,0,0,dev-only; no production traffic
```

Rules: record only observed numbers; zero is a valid entry; never mix mobile
accrual with on-chain π; label projections in `notes` as "scenario".

## 6. What would make this a forecast (checklist)

- ≥ 2 weeks of real session data
- Pi Ad Network approval + observed eCPM
- Real cosmetic conversion from sandbox + Mainnet cohorts
- Confirmed node reward eligibility (if node ever runs)
Until then: scenarios only.

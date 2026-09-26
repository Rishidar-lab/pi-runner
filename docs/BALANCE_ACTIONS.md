# BALANCE_ACTIONS.md — User Balance Analysis & Action Plan

**User:** Rishi (parzival), Tamil Nadu, India
**Date:** 2026-09-27
**Dashboard snapshot:** ~27 Sep 2026 (rounded figures)
**Total:** 575.83 Pi | **Unverified:** 332.51 Pi | **Transferable:** 27.35 Pi | **Migrated:** 215.96 Pi

> **Disclaimer:** Dashboard figures are **rounded estimates**, not on-chain truth. This document gives **no financial advice**. All claims below are evidence-first; hypotheses are labelled. Sources: see `SOURCES.md` (retrieved 2026-09-27).

---

## 1. What the dashboard screenshot does and does NOT establish

### What it DOES establish
- A snapshot of the user's **mobile app dashboard** as rendered by the official Pi app on ~27 Sep 2026.
- The app itself displays four rounded balance categories: Total, Unverified, Transferable, Migrated.
- The app displays a **warning** that referral/security-team members' KYC and migration affect bonus eligibility, and references a **six-month rolling window**.

### What it does NOT establish
- **Not on-chain truth.** The "Transferable" figure is a **pessimistic estimate** computed by the app; actual migration is computed from full mining-session history ([minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/](https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/), 2025-04-17).
- **Not a precise balance.** All figures are rounded; the app itself warns they are estimates.
- **Not a guarantee of migratability.** Unverified Pi requires KYC + migration steps before it can move. Transferable Pi still requires migration to reach the Mainnet wallet.
- **Not a lockup indicator.** Migrated Pi may be partially or fully locked (see §2.3).
- **Not a bonus-eligibility determination.** The dashboard warns that others' KYC/migration status affects bonuses; it does not compute final bonus amounts.
- **Not the individual Grace Period deadline.** The expired global deadline (2025-03-14 08:00 UTC) is NOT the user's individual deadline (see §3).

---

## 2. Balance category breakdown

### 2.1 Unverified mobile balance — 332.51 Pi

**What it is:**
Pi mined on the mobile app that has not yet been migrated to a Mainnet wallet. Per official support: "Unverified/unmigrated Pi is NOT transferable" ([minepi.com/support/](https://minepi.com/support/)). This balance exists only in the app's internal accounting; it has no on-chain representation.

**What evidence is needed to migrate it:**
1. **KYC completion** — Step 6 of the Mainnet Checklist ([minepi.com/kyc-faqs/](https://minepi.com/kyc-faqs/), updated 2025-04-21). KYC requires identity verification (liveness + document).
2. **Email 2FA** — Step 3 of the Mainnet Checklist, required BEFORE 1st and 2nd migrations. Email 2FA has replaced SMS 2FA ([minepi.com/blog/update-on-mainnet-migration-and-account-verification](https://minepi.com/blog/update-on-mainnet-migration-and-account-verification), 2025-03-28).
3. **Mainnet Checklist completion** — The full in-app checklist must be cleared before migration.
4. **Migration transaction** — Initiated from the official app once KYC and 2FA are complete.

**What the user can do:**
- Open the official Pi app → Mainnet tab → review Mainnet Checklist status.
- Complete outstanding steps: email 2FA (Step 3), KYC (Step 6), and any other pending steps.
- KYC involves liveness detection and identity document submission via the official app's KYC flow.
- After KYC is approved, initiate migration from the app.

**What depends on Pi systems / others:**
- **KYC approval** — processed by Pi's KYC providers (including Banxa as a third-party KYC vendor, per [minepi.com/blog/wallet-activation/](https://minepi.com/blog/wallet-activation/), 2025-05-02). Timeline is not user-controllable.
- **Referral/Security Circle members' KYC** — if any Referral Team or Security Circle members have not completed KYC, the corresponding **referral bonus** portion may be forfeited. The second-migrations blog confirms: "referral bonuses for KYC'd Referral Team members" are included in second migrations; missing members → forfeit corresponding bonus ([minepi.com/blog/second-migrations/](https://minepi.com/blog/second-migrations/), 2026-03-26).
- **System blocks** — KYC ineligibility, KYC stuck >1 month, tentative KYC, and system delays can **pause** the individual Grace Period timer ([minepi.com/blog/kyc-grace-period/](https://minepi.com/blog/kyc-grace-period/)).
- **Grace Period window** — the rolling 6-month window (see §3) constrains how long the user has to complete KYC + migration before forfeiting most past balance.

**What moving wallets cannot fix:**
- A separate/new wallet does **not** remove KYC requirements.
- A separate wallet does **not** bypass the migration checklist.
- A separate wallet does **not** make unverified Pi transferable — only KYC + migration does that.
- The passphrase is local-only and unrecoverable ([minepi.com/support/](https://minepi.com/support/)); moving to a new wallet without proper backup risks permanent loss.

---

### 2.2 Transferable-but-not-migrated — 27.35 Pi

**What it is:**
Pi that the app estimates as eligible for migration but has not yet been moved to the Mainnet wallet. The official blog explicitly states: "Transferable Balance in the UI is a pessimistic estimate; actual migration is computed from full mining-session history" ([minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/](https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/), 2025-04-17).

**Critical implication:** The actual migratable amount may be **less than or equal to** 27.35 Pi — never more. The user should not budget against 27.35 Pi as a guaranteed migratable amount.

**What evidence is needed:**
- Same as §2.1: KYC + email 2FA + Mainnet Checklist + migration transaction.
- Additionally: the user should confirm that the specific mining sessions contributing to this transferable amount are fully accounted for in the app's migration computation.

**What the user can do:**
- Same checklist steps as §2.1.
- After migration, verify the actual arrived balance on-chain (see §2.4) rather than relying on the dashboard's Transferable figure.

**What depends on Pi systems / others:**
- Same as §2.1 (KYC processing, system blocks, Grace Period).

**What moving wallets cannot fix:**
- Same as §2.1.

---

### 2.3 Migrated-but-locked Pi — 215.96 Pi

**What it is:**
Pi that has already been migrated to the Mainnet wallet. This balance **has** on-chain representation. However, it may be subject to **on-chain lockups**.

**Lockup rules (official, [minepi.com/blog/on-chain-lockup/](https://minepi.com/blog/on-chain-lockup/), since 2024-07-05):**
- Lockups are **irreversible** — once locked, the lockup cannot be undone.
- Maximum lockup: **up to 200% of the migrated amount**.
| Duration | Multiplier |
|---|---|
| 2 weeks | 0.1× |
| … | … |
| 3 years | 2× |
- Longer lockups → higher multipliers (more mining rewards), but funds are inaccessible for the lockup duration.

**Release conditions:**
- Locked Pi releases according to the on-chain lockup schedule. The release is encoded on-chain; it is not a manual or support-driven process.
- The user should check the official app's wallet section for lockup details (amount locked, duration, expected release).

**What the user can do:**
- Open the official Pi app → Wallet → review lockup status (amount, duration, release schedule).
- Verify on-chain balance and lockup state via Horizon API (see §2.4) using the wallet address.

**What depends on Pi systems / others:**
- Lockup release is governed by on-chain rules; no support intervention can accelerate it.

**What moving wallets cannot fix:**
- Moving to a new wallet does **not** release locked funds. Lockups are tied to the original migration transaction and on-chain lockup contracts.
- A new wallet starts with zero balance; it does not inherit or release lockups from the original wallet.

---

### 2.4 Available on-chain Pi — how to verify actual balance

**Dashboard ≠ on-chain balance.** The mobile dashboard shows app-side estimates. The **actual** Mainnet balance can be verified two ways:

**Method A — Official app wallet:**
- Open the official Pi app → Pi Wallet → view available balance.
- This shows the user's actual Mainnet wallet balance as the app sees it.

**Method B — Horizon API (server-side, no auth for reads):**
- Horizon API is live at [api.mainnet.minepi.com](https://api.mainnet.minepi.com) (verified 2026-09-27: ledger 28,919,439, protocol v27, network_passphrase "Pi Network").
- Relevant endpoints (no auth required for reads):
  - `GET /accounts/{address}` — returns account balance, sequence, signers, etc.
  - `GET /accounts/{address}/transactions` — transaction history.
  - `GET /accounts/{address}/payments` — payment history.
  - `GET /fee_stats` — current fee stats (base fee 100,000 stroops = 0.01 Pi/op, live 2026-09-26).
- The user's Mainnet wallet address can be obtained from the official Pi app (Pi Wallet → receive → address).

**Verification steps:**
1. Obtain the Mainnet wallet address from the official Pi app.
2. Query `GET https://api.mainnet.minepi.com/accounts/{address}`.
3. Compare the `balance` field with the dashboard's "Migrated" figure (215.96 Pi).
4. Note: the on-chain balance reflects **post-migration, post-lockup** state. If lockups exist, the available balance will be less than the total migrated amount.
5. Cross-reference with the app's wallet display for consistency.

**Important:** The Horizon balance is the **settlement truth**. Any discrepancy between the dashboard and Horizon should be resolved in favour of Horizon.

---

## 3. The individual 6-month rolling window

**Official citation:** "Everyone who hasn't migrated to the Mainnet yet will have an individual Grace Period timer" with pauses for system blocks (KYC ineligibility, KYC stuck >1 month, tentative KYC, system delays) and tops up to 1 month when user action is pending <1 month before deadline ([minepi.com/blog/kyc-grace-period/](https://minepi.com/blog/kyc-grace-period/)).

**Rolling window rule:** Fail to submit KYC in the first 3 months of the window or finish migration within 6 months → forfeit most past balance **except** Pi mined in the last 6 months before migration. Forfeited Pi is freed for other KYC'd Pioneers to mine.

**Critical distinction — global deadline ≠ individual deadline:**
- The **global** grace-period deadline of **2025-03-14 08:00 UTC** is **expired** ([minepi.com/blog/grace-period-extension-mar-14](https://minepi.com/blog/grace-period-extension-mar-14)).
- The user's **individual** timer is **app-side**, not public, and cannot be retrieved via API or any documented channel.
- **Do NOT reuse 2025-03-14 as the user's individual deadline.** The individual timer may have started later, been paused by system blocks, or topped up.

**How to check the individual timer:**
- Open the official Pi app → Mainnet tab → look for the individual Grace Period timer display.
- The app may show remaining time; it may also indicate paused states (e.g., "KYC ineligibility", "system delay").
- If no timer is visible, the user should proceed with checklist steps regardless — the timer is a constraint, not a prerequisite.

**Practical consequence:** The user should treat the 6-month window as a hard constraint on KYC + migration completion. Every month of delay reduces the forfeitable balance window.

---

## 4. Exact official-app checks list

Perform these checks in the official Pi app (2026-09-27):

| # | Check | Where in app | What to look for |
|---|---|---|---|
| 1 | Mainnet Checklist status | Mainnet tab → Checklist | All steps complete? Which steps remain? |
| 2 | Individual Grace Period timer (if present) | Mainnet tab → grace-period timer | Remaining time? Paused state? Top-up indicator? |
| 3 | Outstanding KYC steps | Mainnet tab → KYC section | KYC status: not started / pending / tentative / approved / rejected? |
| 4 | Liveness check | KYC flow | Liveness detection passed? Retake if failed? |
| 5 | Email 2FA status | Mainnet tab → Step 3 | Email 2FA confirmed? Required before 1st and 2nd migrations. |
| 6 | Migration wallet confirmed | Mainnet tab → Wallet | Correct Mainnet wallet address displayed? |
| 7 | Migration history | Mainnet tab → Migration history | First migration completed? Second migration initiated? |
| 8 | Lockup amount + release conditions | Wallet → Lockup details | Amount locked? Duration? Expected release date? Multiplier? |
| 9 | Actual available wallet balance | Wallet → Available balance | Compare with dashboard "Migrated" (215.96 Pi). Verify via Horizon API (§2.4). |

---

## 5. Bonus eligibility — referral/security-team members

**Official warning (dashboard):** Referral/security-team members' KYC and migration affect bonus eligibility. The six-month rolling window applies.

**Official policy ([minepi.com/blog/second-migrations/](https://minepi.com/blog/second-migrations/), 2026-03-26):**
- Second migrations include **referral bonuses for KYC'd Referral Team members**.
- If a Referral Team member has **not** completed KYC, the corresponding **referral bonus is forfeited**.
- First migrations **exclude** referral bonuses ([minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/](https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/), 2025-04-17).

**Practical consequence for the user:**
- If the user's Referral Team or Security Circle includes members who have not completed KYC or migration, the user's bonus Pi may be reduced or forfeited.
- The user cannot force other members to complete KYC; this is outside the user's control.
- The user should focus on their own KYC + migration checklist to maximise their own balance, and encourage team members to complete their own steps (see §6).

---

## 6. Voluntary reminder DRAFT — for existing referral/security-circle members

> **STATUS: DRAFT — DO NOT SEND.** This is a template for the user's own editing. Do not send without review. **Do not collect identity documents.**

---

**Subject:** Pi Mainnet KYC & Migration — Check your status

Hi [Name],

I'm completing my Pi Mainnet KYC and migration checklist. The app shows that referral/security-team members' KYC and migration status affects bonus eligibility for everyone in the team.

If you haven't already, please check your own Pi app:
- Open the Mainnet tab
- Review your Mainnet Checklist status
- Complete email 2FA (Step 3) and KYC (Step 6) if not done
- Check your individual Grace Period timer

You can find details at [minepi.com/kyc-faqs/](https://minepi.com/kyc-faqs/).

This is a voluntary reminder only. I am not collecting any personal documents or information.

Best,
[Your name]

---

**Safety notes:**
- Do **not** ask for identity documents, passport numbers, KYC confirmation codes, or wallet passphrases.
- Do **not** offer to "help" someone complete KYC for a fee — this is a common scam vector.
- Official email domains are `@pi.email`, `@picoreteam.org`, `@minepi.com` (Safety Center). Verify any communication claiming to be from Pi against these domains.

---

## 7. Factual support-request DRAFT

> **STATUS: DRAFT — DO NOT SEND.** This is a template for the user's own editing. Do not send without review. **No promises of restoration.**

---

**To:** Pi Developer Support — [https://support.help.minepi.com](https://support.help.minepi.com) (Bug Report form id 10 / Developers form id 20)

**Subject:** Migration/KYC status inquiry — [Username]

Hello,

I am writing to inquire about my Mainnet migration status. My dashboard shows:
- Total: [X] Pi
- Unverified: [X] Pi
- Transferable: [X] Pi
- Migrated: [X] Pi

I would like to understand:
1. My current Mainnet Checklist status and any outstanding steps.
2. Whether my individual Grace Period timer is visible to support (I can see [X] in the app).
3. Whether my KYC has been received and its current status.
4. Whether my migration has been processed and the expected arrival amount.

I understand that dashboard figures are estimates and that actual migration amounts are computed from full mining-session history.

Username: [Redacted]
Wallet address: [Redacted — do not include passphrase]

Thank you,
[Your name]

---

**Safety notes:**
- Do **not** include your passphrase, secret key, or 24-word seed phrase in any support request. Pi servers "never have access to your secret key or passphrase" ([minepi.com/support/](https://minepi.com/support/)) — support does not need it.
- Do **not** include identity document images unless explicitly requested through the official KYC flow inside the app.
- Do **not** promise or expect restoration of unverified Pi — this document does not guarantee any outcome.

---

## 8. Explicit non-goals

This document explicitly does **NOT**:

1. **Promise restoration or conversion of unverified Pi.** Unverified Pi (332.51 Pi) requires KYC + migration; there is no mechanism to "force" conversion.
2. **Claim that a separate wallet can remove KYC, migration, or lockup restrictions.** A new wallet does not bypass any of these.
3. **Guarantee any specific migrated or transferable amount.** Dashboard figures are rounded estimates; actual amounts are computed by Pi systems.
4. **Provide financial advice.** This is an evidence-based action document only.
5. **Guarantee bonus eligibility.** Bonus eligibility depends on others' KYC/migration status, which the user cannot control.
6. **Recommend sending the drafts in §6 or §7.** Both are marked DO NOT SEND.
7. **Recommend any action that would violate the Developer ToS** ([socialchain.app/developer_terms](https://socialchain.app/developer_terms), §4: no reverse engineering, hacking, scripting/unintended use) or any law.

---

*Document generated 2026-09-27. All sources retrieved 2026-09-27. Dashboard figures are rounded estimates. No financial advice. See `SOURCES.md` for full evidence base.*

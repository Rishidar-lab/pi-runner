# EARNING_ROUTES — pi-runner

**Compiled:** 2026-09-27
**Scope:** All plausible routes by which players of this game, and the game itself, could earn Pi or other value within the Pi Network ecosystem. Evidence-first; scenario outputs are explicitly marked.

**Important:** Nothing in this document should be read as a guarantee of income. Spending Pi, viewing ads, staking, engagement, and gameplay do not constitute guaranteed revenue unless a published programme explicitly states so.

---

## 1. Mobile Mining (Phone-based Pi accrual)

**Who earns:** The individual Pioneer (player), not the game.

**What is earned:** Mobile Pi accrual at the user's personal mining rate — not native Mainnet Pi. Pi mined on mobile is subject to Mainnet migration and lockup rules. The game itself does not earn from a player's mobile mining.

**Rate composition (per minepi.com/support/):**
- Base mining rate
- Security Circle: +20% per member, up to 5 members
- Referral Team: +25% per concurrent referral
- Lockups (optional, user-configured)
- App-usage boosts (optional; requires active use of Pi apps)
- Node rewards (if the user runs a Pi Node)

Rates decline monthly. The exact current base rate is set by the Pi Core Team and changes over time; see the in-app mining screen for the live value.

**Eligibility/approvals:** Any Pioneer with the Pi mobile app. Account must pass KYC before migrated Pi can be transacted on Mainnet.

**Country restrictions:** No India-specific restriction found in primary sources. US OFAC-sanctioned countries are barred per the Developer ToS (socialchain.app/developer_terms, 2023-01-09). Players should confirm their own country eligibility in-app.

**Setup/ongoing work:** Install Pi app, mine at least once per 24-hour cycle, optionally build Security Circle, run a node, lock up Pi.

**Costs:** Time and electricity (if running a node). No Pi payment required to mine.

**Crediting/payout:** Pi accrues in the user's mobile account and migrates to Mainnet after KYC and migration. Not directly spendable in our game until migrated and transferred.

**Migration/liquidity restrictions:** Migrated Pi is subject to the sender's chosen lockup settings. Pi received from others may carry lockup restrictions depending on the sender's wallet configuration.

**Current availability:** Available to all Pioneers; rate changes monthly.

**Evidence:** minepi.com/support/

**Uncertainty:** Current base rate not fixed; future rate changes are at Core Team discretion. App-usage boost mechanics may change.

---

## 2. Node Rewards

**Who earns:** Pioneers who run a Pi Node on a computer.

**What is earned:** A share of Pi allocated to node operators, computed per the node contribution algorithm. This is mobile-accrual Pi, not game revenue.

**Eligibility/approvals:** FAQ states "open to any Pioneer with a computer connected to the internet." Rewards are "computed based on reliability and accessibility." Protocol upgrades are mandatory — nodes must stay updated.

**Country restrictions:** No India-specific restriction documented in primary sources.

**Setup/ongoing work:** Install Pi Node software, keep online, apply mandatory updates.

**Costs:** Hardware (computer), electricity, internet bandwidth.

**Crediting/payout:** Accrues to the node operator's mobile Pi account; migrates to Mainnet post-KYC.

**Migration/liquidity restrictions:** Same as mobile mining.

**Current availability:** Available; subject to Core Team protocol upgrades.

**Evidence:** minepi.com/support/ (FAQ); Pi Node announcement blog post.

**Uncertainty:** A Pi Node FAQ excerpt says node contribution rewards are "not directly tied to Node rewards," which appears contradictory with the support page. The exact reward algorithm is not public. Treat node rewards as variable and unpredictable.

---

## 3. KYC Validator Rewards

**Who earns:** Pioneers who perform KYC validations on behalf of the network.

**What is earned:** A fixed reward pool distributed per validated identity. Round 1 (paid Pi Day 2026 → Apr 3, 2026): 16,568,774 Pi pool + 10,000,000 Pi Foundation sponsorship ÷ 526,970,631 validations = **0.0504179 Pi per validation** (approximately 21× the base mining rate at the time).

**Round 1 eligibility:**
- ≥50 majority-agreed validations completed by 2026-03-05
- Mainnet wallet

**Scale:** 1,094,680 human validators participated; 18 million identities verified.

**Country restrictions:** KYC'd Pioneers per country/region; accuracy-gated volume. Some countries may have limited validator slots.

**Setup/ongoing work:** Pass Pioneer KYC, complete validator training/entry, perform validation tasks on an ongoing basis.

**Costs:** Time; no Pi payment.

**Crediting/payout:** Round 1 was paid (Apr 3, 2026). A second round is in preparation; terms not yet announced.

**Current availability:** Round 1 concluded. Round 2 preparation announced but no start date or eligibility criteria published as of 2026-09-27.

**Evidence:** minepi.com/blog/kyc-validator-rewards/ (2026-04-03); minepi.com/blog/kyc-validator/ (2024-10-11)

**Uncertainty:** Round 2 eligibility, pool size, and per-validation rate are unknown. Participation in round 1 does not guarantee round 2 eligibility.

---

## 4. In-Game Purchases (Cosmetic, U2A — User-to-App)

**Who earns:** The game developer (us).

**What is earned:** Native Mainnet Pi, credited to the developer's Mainnet wallet upon a successful U2A transaction.

**What the player receives:** Cosmetic items, visual customisations, or non-gameplay-advantage content explicitly designed and disclosed as cosmetic. No gameplay advantage should be sold as cosmetic.

**Eligibility/approvals:**
- Pi SDK integration with U2A payment flow.
- Developer must have a Mainnet wallet.
- Transactions must be Pi-only (no fiat or other crypto).
- Developer KYC may be required for payout (verify current requirements at developers.minepi.com).

**Country restrictions:** No India-specific restriction found. US OFAC-sanctioned countries barred per Developer ToS. Individual countries may have Pi availability restrictions.

**Setup/ongoing work:** Implement Pi SDK U2A flow, build cosmetic catalogue, set prices, test transactions, process refunds/edge cases.

**Costs:** Pi SDK integration development time; potential refund handling.

**Crediting/payout:** Pi is transferred on-chain to the developer wallet upon U2A completion. The developer controls liquidity.

**Migration/liquidity restrictions:** Pi received via U2A is Mainnet Pi and is liquid (subject to any developer-side lockups the developer may choose to apply).

**Current availability:** U2A is the standard supported payment flow for Pi apps.

**Evidence:** minepi.com/developers/; pi-apps/pi-platform-docs

**Uncertainty:** Developer payout timing and any holding periods should be confirmed with the Developer Portal. Price elasticity for cosmetic items in the Pi ecosystem is untested.

---

## 5. Pi Ad Network — Developer Revenue

**Who earns:** Apps that display ads through the Pi Ad Network.

**What is earned:** Native Mainnet Pi from advertisers paying to place ads.

**Key distinction — display vs. monetisation:**
- **Display open to all apps:** Any Pi app can integrate the Pi Ad Network SDK and display ads.
- **Monetisation requires Pi Core Team approval:** Apps must apply via the developer portal and be approved before earning ad revenue. Approval is not guaranteed.

**Reward verification:** Rewards are verified via `GET /ads_network/status/:adId`. A reward is credited only if `mediator_ack_status === "granted"`. Do not rely on client-side ad-completion events for revenue accounting.

**Banner ads:** Not included in the SDK. A "Loading Banner Ads" toggle exists but availability is limited.

**Eligibility/approvals:** Pi Core Team approval via portal for monetisation. Pi SDK integration required.

**Country restrictions:** Ad availability may vary by advertiser targeting. No India-specific restriction documented.

**Setup/ongoing work:** Integrate Pi Ad Network SDK, implement ad placement, monitor status endpoint, optimise fill rate.

**Costs:** Integration development; potential impact on game performance/load time.

**Crediting/payout:** Pi from advertisers, credited per the `mediator_ack_status === "granted"` confirmation. Exact payout schedule not published in primary sources.

**Current availability:** Pi Ad Network is live. "Loading Banner Ads" availability is limited.

**Evidence:** pi-apps/pi-platform-docs (ads.md); developers.minepi.com

**Uncertainty:** Ad fill rates and CPM in the Pi ecosystem are not published. Revenue may be negligible at low traffic. Do not project ad revenue without live data.

---

## 6. Rewarded Ads (Player Benefit)

**Who earns:** The player (if the game chooses to reward ad views).

**What is earned:** This is a **design choice by the developer**, not a protocol feature. If implemented, rewards could be:
- Game points (non-Pi, non-transferable)
- Cosmetic in-game items
- A small amount of native Mainnet Pi (if funded by ad revenue or developer budget)

**Critical clarification:** Viewing ads is NOT a guaranteed income route. The player receives a reward only if and when the developer chooses to grant one. There is no Pi Network protocol that pays players for watching ads.

**Eligibility/approvals:** Developer-defined. May require Pi login, ad SDK completion callbacks, and anti-fraud checks.

**Country restrictions:** Ad availability varies by region and advertiser targeting. Some players may not have ad inventory available.

**Setup/ongoing work (developer side):** Integrate rewarded ad SDK, define reward logic, prevent ad fraud, monitor completion rates.

**Costs (developer side):** Ad revenue share to ad network; potential Pi budget if paying Pi rewards.

**Crediting/payout:** Developer-controlled. If Pi is rewarded, it comes from the developer's Pi budget, not from the protocol.

**Current availability:** Implementation-dependent; not a feature of Pi SDK by default.

**Evidence:** pi-apps/pi-platform-docs (ads.md); minepi.com/developers/

**Uncertainty:** Rewarded ad mechanics are entirely developer-defined. Players should understand that ad viewing is a way to earn optional in-game benefits at the developer's discretion, not an income stream.

---

## 7. Official Hackathons, Campaigns, and Prizes

**Who earns:** App developers and teams.

**What is earned:** Native Mainnet Pi prizes (hackathon) or other compensation defined per campaign.

### 7a. Pi Hackathon 2025 (completed)
- **Dates:** 2025-08-15 → 2025-10-15
- **Prizes:** 160,000 Pi total — 1st: 75,000; 2nd: 45,000; 3rd: 15,000; 5 × honorable mentions: 5,000 each
- **Submissions:** 215+ Mainnet submissions
- **Winners announced:** 2025-12-11 (1st: Blind_Lounge)
- **KYC requirement:** All team members needed KYC.
- **Status:** Concluded.

### 7b. Monthly #PiHackathon
- **Description:** Page on minepi.com/developers/pi-hackathon/ describes an "ongoing" monthly 10,000 Pi prize via the Brainstorm app.
- **2026 continuation:** NOT VERIFIED from primary sources as of 2026-09-27. Do not assume the monthly hackathon is active.

### 7c. 2026 Hackathon
- **Status:** No 2026 hackathon announced as of 2026-09-27.

### 7d. Other campaigns
- No other Pi Core Team campaigns with published prizes found in primary sources as of 2026-09-27.

**Country restrictions:** No India-specific restriction documented. OFAC-sanctioned countries barred per Developer ToS.

**Setup/ongoing work:** Build a Mainnet app, form a team, ensure all members pass KYC, submit before deadline.

**Evidence:** minepi.com/blog/pi-hackathon-2025/; minepi.com/blog/hackathon-2025-winners/; minepi.com/developers/pi-hackathon/

**Uncertainty:** Hackathon schedules are announced at Core Team discretion. Future prize pools and eligibility may differ. The monthly #PiHackathon's 2026 status is unverified.

---

## 8. Ecosystem Directory Staking (Visibility, NOT Income)

**Who uses it:** App developers (including us).

**What it provides:** Improved ranking/visibility in the Pi ecosystem directory when Pioneers or businesses stake Pi on the app.

**Critical clarification:**
- **No protocol-level rewards for staking.** The official blog states: "there are no Pi rewards on the protocol level for the staking as it does not make sense for the network to promote one Pi app over another."
- **Principal is returned** after the staking duration.
- **Individual app developers may offer their own incentives** to stakers (e.g., in-game items, cosmetics). This is optional and developer-funded.
- Staking does NOT guarantee top placement. No published ranking formula exists. No guaranteed top placement.

**Eligibility/approvals:** Launched Pi2Day 2025 (rollout from 2025-06-28). Pioneers and businesses stake Pi on Mainnet to boost app visibility.

**Country restrictions:** No India-specific restriction documented.

**Setup/ongoing work (developer side):** Ensure the app is listed in the directory; optionally design and fund an incentive programme for stakers (at developer's own cost).

**Costs (developer side):** If offering incentives, the developer funds them from their own Pi budget or revenue.

**Crediting/payout:** Not applicable as an income route. Stakers receive their principal back. Any incentives are developer-funded and developer-defined.

**Current availability:** Live since Pi2Day 2025.

**Evidence:** minepi.com/blog/pi2day2025/ (updated 2026-05-28)

**Uncertainty:** Ranking algorithm is not published. Visibility improvement from staking may vary by category and user. Do not promise stakers specific placement outcomes.

---

## 9. Pi Network Ventures

**Who earns:** Portfolio companies (not players).

**What is earned:** VC equity investment from a $100M Pi Foundation fund. Stages: early-stage → Series B+. Sectors include gaming.

**Key clarification:** This is **equity investment via Google Form application**, NOT grants, NOT Pi tokens, NOT revenue for a game. The fund takes equity in the company.

**Eligibility/approvals:** Application via Google Form; Pi Foundation selection. Highly competitive.

**Evidence:** minepi.com/ventures/

**Relevance to this game:** Only relevant if the developer forms a company and seeks VC funding. Not a route for in-game players.

---

## 10. Pi App Incubator

**Who earns:** Selected developer teams.

**What is earned:** 12-week incubator programme (mentorship, resources). 2024 cohort had 5 teams.

**Status:** No next-cohort announcement found as of 2026-09-27. The 2024 announcement is search-visible only (minepi.com/blog/incubator-program/, 2024-09-12).

**Evidence:** minepi.com/blog/incubator-program/

**Uncertainty:** Future cohorts not announced.

---

## Summary Table

| Route | Who earns | What is earned | Type of value | Current availability |
|-------|-----------|---------------|---------------|---------------------|
| Mobile mining | Player | Pi (mobile accrual → Mainnet) | Pi (subject to lockup) | Live |
| Node rewards | Player (node operator) | Pi (mobile accrual → Mainnet) | Pi (subject to lockup) | Live |
| KYC validator rewards | Player (validator) | Pi per validation | Pi (Mainnet) | Round 1 paid; Round 2 TBD |
| U2A purchases | Developer | Mainnet Pi | Pi (liquid) | Live |
| Pi Ad Network | Developer (approved apps) | Mainnet Pi | Pi (liquid) | Live (approval required) |
| Rewarded ads | Player (if developer opts in) | Game points / cosmetics / Pi | Varies | Developer-defined |
| Hackathon prizes | Dev teams | Mainnet Pi | Pi (liquid) | 2025 concluded; 2026 TBD |
| Directory staking | N/A (visibility only) | No income; principal returned | N/A | Live |
| Ventures | Companies (equity) | USD investment (equity) | Non-Pi | Live (application) |
| Incubator | Dev teams | Programme access | Non-Pi | 2024 only |

---

## What Is NOT an Earning Route

- **Spending Pi** — not income; it is expenditure.
- **Staking Pi** — not income; principal is returned but no interest or protocol rewards are paid.
- **Viewing ads** — not guaranteed income; only yields rewards if the developer chooses to grant them.
- **Playing the game** — not income unless the developer explicitly defines a reward mechanism.
- **Testnet tokens** — have no monetary value and cannot be converted to Mainnet Pi.
- **Game points / leaderboard scores** — non-transferable, non-Pi, no monetary value unless the developer chooses to redeem them.

---

*All facts sourced from Pi Network primary domains as cited. No third-party claims are relied upon. Scenario outputs are marked inline. Last verified: 2026-09-27.*

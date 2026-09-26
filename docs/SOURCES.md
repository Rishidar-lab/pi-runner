# SOURCES.md — Pi Network Evidence Base

**Session:** 2026-09-27 | **Operator:** Rishi (parzival) | **Purpose:** Bug-bounty/app project research. Evidence-first document: every claim row separates verified fact from hypothesis. No URLs are fabricated; every URL below was either verified live on 2026-09-27 by prior research or is a community-reported indicator with that status flagged.

---

## 0. Intro — Method, Date, Domain Verification

**Method.** All sources are first-party (minepi.com and its official subdomains, developers.minepi.com, socialchain.app, pinet.com, github.com/pi-apps) unless explicitly labelled community-report / hypothesis. Retrieval date for every row is **2026-09-27**. Publication/update dates are taken from the source page itself where stated; where a page shows no date, the best-known date from the announcement chain is used and marked. Confidence levels:

- **VERIFIED** — page/API observed live or official doc retrieved 2026-09-27.
- **HIGH** — official blog announcement with explicit date, not re-fetched live for every row.
- **MEDIUM** — community report / corroborated third-party, clearly flagged.
- **LOW / HYPOTHESIS** — unverified; do not rely on without confirmation.

**Official first-party domains verified (2026-09-27):** minepi.com (© SocialChain Inc.), developers.minepi.com (Pi Docs, © Pi Project Inc.), blockexplorer.minepi.com, api.minepi.com/v2 (Platform API), api.mainnet.minepi.com (Horizon API — live: ledger 28,919,439, protocol v27, network_passphrase "Pi Network"), sdk.minepi.com/pi-sdk.js, apt.minepi.com (APT repo + GPG key), pinet.com (PiNet), socialchain.app (legal docs), github.com/pi-apps (pi-platform-docs, PiOS).

**Copycat confirmed:** pinet-pi.info (lookalike, NOT linked from any official page). pi-blockchain-explorer.pinet.com does NOT exist. Treat any domain not in the official list as untrusted for bug-bounty/app work.

**No security.txt** on minepi.com / pinet.com / api.minepi.com / developers.minepi.com / socialchain.app (all 404, checked 2026-09-27). No SECURITY.md in pi-apps repos or org policy. General bug-report form: https://support.help.minepi.com/servicedesk/customer/portal/1/create/10. No security/vulnerability-specific form. hackerone.com/pi → 403 Cloudflare (not verifiable). No bounty-platform links on any first-party page.

---

## A. Migration & KYC

### A.1 Current official policy

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Migration = KYC-verified mobile balance → Mainnet wallet. Unverified/unmigrated Pi is NOT transferable. | https://minepi.com/support/ | Pi Core Team / SocialChain Inc. | undated (support page) | 2026-09-27 | VERIFIED | Bug-bounty/app claims that touch "unverifiable/untransferable balances" must start here; this is the canonical definition. |
| Mainnet Checklist is in-app. Step 3 = Pi Wallet email 2FA, required BEFORE 1st and 2nd migrations. | https://minepi.com/kyc-faqs | Pi Core Team | updated 2025-04-21 | 2026-09-27 | HIGH | Any migration test must clear email 2FA first; liveness/KYC steps come later in the checklist. |
| Step 6 of checklist = KYC. | https://minepi.com/kyc-faqs | Pi Core Team | updated 2025-04-21 | 2026-09-27 | HIGH | KYC is a late-step gate; app-side balance estimates before Step 6 are structurally uncertain. |
| Wallet activation (2025-05-02) includes tentative KYC + Banxa third-party KYC; activation is NOT migration. | https://minepi.com/blog/wallet-activation/ | Pi Core Team | 2025-05-02 | 2026-09-27 | HIGH | Fast-Track wallets were activated, not migrated; conflating the two produced the 497k gas-fee incident (see A.2). |
| Second migrations rolling out since Pi Day 2026 (2026-03-26); 119k+ done; include referral bonuses for KYC'd Referral Team members; first migrations prioritized. | https://minepi.com/blog/second-migrations/ | Pi Core Team | 2026-03-26 | 2026-09-27 | HIGH | Referral bonus credit is now an active, date-stamped migration path — material for any app that displays "bonus eligible" status. |
| Fast Track KYC (2025-09-18) is wallet activation, NOT migration; <30 sessions. | https://minepi.com/announcement/fast-track-kyc/ | Pi Core Team | 2025-09-18 | 2026-09-27 | HIGH | Apps/testers using Fast-Track wallets should not assume mainnet transferability. |
| KYC FAQs page updated 2025-04-21; current checklist steps as above. | https://minepi.com/kyc-faqs | Pi Core Team | updated 2025-04-21 | 2026-09-27 | HIGH | Use this as the live checklist reference; do not mirror it into app code without a freshness check. |

### A.2 Historical announcements

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Grace period: 6-month window enacted 2024-07-01; extended to final deadline 2025-03-14 08:00 UTC. | https://minepi.com/blog/grace-period-extension-mar-14 | Pi Core Team | 2025-03-14 | 2026-09-27 | HIGH | This GLOBAL deadline is expired. Do NOT reuse it as any user's individual deadline (see BALANCE_ACTIONS.md §3). |
| Individual Grace Period: "Everyone who hasn't migrated to the Mainnet yet will have an individual Grace Period timer", with pauses for system blocks (KYC ineligibility, KYC stuck >1 month, tentative KYC, system delays) and tops up to 1 month when user action is pending <1 month before deadline. | https://minepi.com/blog/kyc-grace-period/ | Pi Core Team | undated (referenced by 2025 grace-period chain) | 2026-09-27 | HIGH | Individual timers are app-side, not public. Any balance-related test must read the timer from the official app, not infer it from the global deadline. |
| Rolling 6-month window: fail to submit KYC in first 3 months or finish migration within 6 months → forfeit most past balance except Pi mined in the last 6 months before migration; forfeited Pi freed for other KYC'd Pioneers to mine. | https://minepi.com/blog/kyc-grace-period/ | Pi Core Team | undated | 2026-09-27 | HIGH | High-stakes rule; app-side warnings must not promise restoration. |
| Transferable Balance in the UI is a PESSIMISTIC ESTIMATE; actual migration is computed from full mining-session history. | https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/ | Pi Core Team | 2025-04-17 | 2026-09-27 | HIGH | Dashboard "Transferable" must never be treated as on-chain truth (see BALANCE_ACTIONS.md §1). |
| 1st migration excludes referral bonuses. | https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/ | Pi Core Team | 2025-04-17 | 2026-09-27 | HIGH | Post-migration balance reconciliation must exclude referral bonuses for first migrations. |
| Mainnet migration roadmap & tokenomics (migrations scale, balance rules). | https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/ | Pi Core Team | 2025-04-17 | 2026-09-27 | HIGH | Baseline for migration-era balance math. |
| Update on mainnet migration and account verification (email 2FA replaced SMS; migration paused early 2025 then resumed). | https://minepi.com/blog/update-on-mainnet-migration-and-account-verification | Pi Core Team | 2025-03-28 | 2026-09-27 | HIGH | SMS-2FA assumptions are stale; email 2FA is the current path. |
| Fast-Track wallet fix deployed week of 2026-09-17 (497k Pioneers stuck with Fast-Track wallets lacking gas fee). | https://minepi.com/blog/kyc-mainnet-migration-9-26/ | Pi Core Team | 2026-09-17 | 2026-09-27 | HIGH | Live incident context; relevant to gas-fee / wallet-state testing. |
| Batch unblocks: 2.5M (2026-01-30) and 417k duplicate-account case (2026-09-07). | (as reported via official channels; recompute against live scale below) | Pi Core Team | 2026-01-30 / 2026-09-07 | 2026-09-27 | MEDIUM | Batch KYC/migration events cause step-changes in aggregate stats; cross-check live scale before concluding. |

### A.3 Directly observed behaviour (live, 2026-09-27)

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Horizon API is live: ledger 28,919,439, protocol v27, network_passphrase "Pi Network". | https://api.mainnet.minepi.com | Pi Core Team | live | 2026-09-27 | VERIFIED | Protocol v27 is current; protocol-20 smart-contract foundation landed 2026-03 (see D.2). |
| api.minepi.com/v2 Platform API is live (see B.1 for endpoint auth model). | https://api.minepi.com/v2 | Pi Core Team | live | 2026-09-27 | VERIFIED | Server-side payment flows can be exercised against this API. |
| No security.txt on any of minepi.com / pinet.com / api.minepi.com / developers.minepi.com / socialchain.app (404). | (paths /.well-known/security.txt, /security.txt) | — | checked 2026-09-27 | 2026-09-27 | VERIFIED | Responsible disclosure must use the general bug-report form, not a security.txt channel. |
| hackerone.com/pi → 403 Cloudflare (not verifiable). | https://hackerone.com/pi | HackerOne | checked 2026-09-27 | 2026-09-27 | VERIFIED (observation) | Do not rely on a HackerOne program existing. |
| No bounty-platform links on any first-party page. | (site-wide, prior research) | — | checked 2026-09-27 | 2026-09-27 | VERIFIED | No public bounty programme is linked from official pages. |

### A.4 Community reports

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| CGNAT blocks inbound connections; port-openability is a node-selection criterion; no official workaround. | https://github.com/pi-node/instructions#528 | Community (GitHub issue) | undated | 2026-09-27 | MEDIUM | Node testing behind CGNAT will show false negatives; document this as environment limitation, not a bug. |

### A.5 Hypotheses (LOW confidence — do not rely without confirmation)

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Whether a public paid bug bounty with Pi payouts exists at all. | (none found) | — | — | 2026-09-27 | HYPOTHESIS | Private programme cannot be excluded; absence of evidence ≠ evidence of absence. |
| Dashboard "Transferable" figures are pessimistic estimates (supported by A.2 transferable-balance row but not re-derived live). | https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/ | Pi Core Team | 2025-04-17 | 2026-09-27 | HIGH (per blog) / HYPOTHESIS (per-user live value) | Treat every per-user transferable number as an estimate, not a guarantee. |

---

## B. Wallet & APIs

### B.1 Current official policy

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Pi Wallet is noncustodial: "Pi servers never have access to your secret key or passphrase"; passphrase is local-only and unrecoverable. | https://minepi.com/support/ ; https://developers.minepi.com/docs/accept-payment/PiWallet | Pi Core Team / Pi Project Inc. | undated | 2026-09-27 | VERIFIED | App integrations must not assume server-side key custody; loss = permanent loss. |
| Same passphrase derives both Mainnet and Testnet addresses. | https://minepi.com/support/ | Pi Core Team | undated | 2026-09-27 | VERIFIED | Testnet testing can reuse a passphrase derivation, but Testnet tokens are not real (see D.1). |
| Platform API v2 auth model: `Authorization: Bearer <user token>` for GET /me; `Authorization: Key <Server API Key>` for server-only payment endpoints. | https://developers.minepi.com/docs/api-reference/PlatformAPI | Pi Project Inc. | undated (docs) | 2026-09-27 | VERIFIED | Server API Key must never be shipped client-side (reiterated in developer docs — see D.1). |
| Server-only endpoints: POST /payments (A2U), GET /payments/{id}, POST .../approve, .../complete {"txid}, .../cancel, GET /payments/incomplete_server_payments, GET /ads_network/status/:adId, POST /v2/in_app_notifications/notify. | https://developers.minepi.com/docs/api-reference/PlatformAPI | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | These are the server-surface endpoints; A2U flow requires POST /payments. |
| Horizon API (read-only, no auth for reads): /accounts/{id}, /accounts/{id}/transactions, /transactions/{hash}, /fee_stats, /payments, /ledgers, /operations. | https://api.mainnet.minepi.com | Pi Core Team | live | 2026-09-27 | VERIFIED | Balance verification for a user can be done server-side against Horizon by address (see BALANCE_ACTIONS.md §2.4). |
| Base fee = 100,000 stroops = 0.01 Pi/op (live 2026-09-26). | https://api.mainnet.minepi.com/fee_stats | Pi Core Team | live 2026-09-26 | 2026-09-27 | VERIFIED | A2U payment math must budget 0.01 Pi/op for fees. |
| Min balance reserve exists; amount NOT officially stated (community ~1 Pi, unverified). | https://minepi.com/support/ | Pi Core Team | undated | 2026-09-27 | HIGH (existence) / LOW (amount) | Do not bake a hardcoded min-balance into app logic; read live fee_stats instead. |
| On-chain lockups since 2024-07-05: irreversible; up to 200% of migrated amount; multipliers 0.1× (2 weeks) to 2× (3 years). | https://minepi.com/blog/on-chain-lockup/ | Pi Core Team | 2024-07-05 | 2026-09-27 | HIGH | Lockup-released balance is a separate, on-chain-verifiable quantity (see BALANCE_ACTIONS.md §2.3). |
| Network identifier: passphrase "Pi Network"; Stellar-based, NOT EVM. | https://api.mainnet.minepi.com | Pi Core Team | live | 2026-09-27 | VERIFIED | EVM tooling/assumptions do not apply; use Stellar-style stroop math. |

### B.2 Historical announcements

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| RPC server (rpc.testnet.minepi.com, JSON-RPC getHealth) — reads free, Testnet only. | https://minepi.com/blog/rpc-server/ | Pi Core Team | 2026-04-08 | 2026-09-27 | HIGH | Testnet is the safe surface for RPC experiments; no free mainnet RPC. |
| Pi Day 2026: protocol 20 foundation (2026-03); subscriptions prioritized; audit→review→testnet→mainnet pipeline. | https://minepi.com/blog/pi-day-2026/ | Pi Core Team | 2026-03 | 2026-09-27 | HIGH | Smart-contract surface is gated by pipeline; expect staged rollouts. |
| Wallet activation 2025-05-02 incl. tentative KYC + Banxa third-party KYC. | https://minepi.com/blog/wallet-activation/ | Pi Core Team | 2025-05-02 | 2026-09-27 | HIGH | KYC vendors include Banxa; support flows must tolerate third-party KYC states. |

### B.3 Directly observed behaviour

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Horizon live: ledger 28,919,439, protocol v27. | https://api.mainnet.minepi.com | Pi Core Team | live | 2026-09-27 | VERIFIED | Confirms current protocol and ledger height. |
| No auth required for Horizon read endpoints. | https://api.mainnet.minepi.com | Pi Core Team | live | 2026-09-27 | VERIFIED | Balance checks are feasible server-side without user tokens. |
| Platform API v2 live and reachable at api.minepi.com/v2. | https://api.minepi.com/v2 | Pi Core Team | live | 2026-09-27 | VERIFIED | Payment-flow tests can target this API. |

### B.4 Hypotheses / Unknowns

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Exact min-balance reserve amount (~1 Pi community figure). | https://minepi.com/support/ | Community | undated | 2026-09-27 | LOW | Do not hardcode; verify per-network via fee_stats / Horizon. |
| Whether passphrase-derived addresses can be re-derived offline by the app for display purposes. | https://minepi.com/support/ | Pi Core Team | undated | 2026-09-27 | HYPOTHESIS | Same-passphrase derivation is confirmed for Mainnet+Testnet; offline derivation is a wallet-implementation detail. |

---

## C. Node

### C.1 Current official policy

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Linux Node via apt.minepi.com: GPG key at https://apt.minepi.com/repository.gpg.key ; source https://apt.minepi.com ; `apt-get install pi-node`; CLI: pi-node initialize\|start\|stop\|restart\|status\|logs -f\|update-protocol. Docker + Compose v2 also supported. | https://minepi.com/pi-blockchain/pi-node/linux/ | Pi Core Team | undated | 2026-09-27 | VERIFIED | Node testing should use this documented install path; apt+Docker both supported. |
| Hardware specs: 150 GB disk min (300 GB ideal), 4 vCPU, 4 GB RAM, Ubuntu 24.04 suggested. | https://minepi.com/pi-blockchain/pi-node/linux/ | Pi Core Team | undated | 2026-09-27 | VERIFIED | Provisioning below 150 GB will fail; treat as minimum for any node-based testing. |
| Roles: Computer App / Node / SuperNode; SCP consensus. | https://minepi.com/pi-node/ | Pi Core Team | 2022-era (self-disclaimed) | 2026-09-27 | HIGH | minepi.com/pi-node/ is self-disclaimed as 2022-era; use the Linux-node page for current install truth. |
| One account = one node. | https://minepi.com/pi-blockchain/pi-node/linux/ | Pi Core Team | undated | 2026-09-27 | VERIFIED | Multi-node testing per account is not a supported config. |
| Port-openability is a node-selection criterion; CGNAT blocks inbound (community report, no official workaround). | https://minepi.com/blog/open-network-launch-date/ ; https://github.com/pi-node/instructions#528 | Pi Core Team / Community | undated | 2026-09-27 | HIGH / MEDIUM | Node-reachability tests must control for CGNAT. |
| Mainnet nodes: anyone can technically run; CT gradually invites Testnet→Mainnet by reliability. | https://minepi.com/blog/open-network-launch-date/ | Pi Core Team | undated | 2026-09-27 | HIGH | Mainnet node testing is by invitation; Testnet is the realistic surface. |
| Protocol upgrades are mandatory with hard deadlines (v27 live 2026-09-26; v28 in progress). | https://api.mainnet.minepi.com ; https://minepi.com/pi-blockchain/pi-node/linux/ | Pi Core Team | live | 2026-09-27 | VERIFIED | Node tests must pin protocol version; auto-update (Linux CLI 2025-08-25) can shift baseline mid-test. |
| Linux CLI 2025-08-25 includes auto-update. | https://minepi.com/pi-blockchain/pi-node/linux/ | Pi Core Team | 2025-08-25 | 2026-09-27 | HIGH | Non-obvious: auto-update can change node behavior without explicit action. |

### C.2 Contradictory / unclear (see Stale/contradictory flags §X)

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Node rewards: FAQ says "open to any Pioneer with a computer connected to the internet... computed based on reliability and accessibility" BUT Linux node post says "not directly tied to Node rewards". Press reports missed upgrades lose validation rewards. | https://minepi.com/pi-node/ ; https://minepi.com/pi-blockchain/pi-node/linux/ | Pi Core Team | 2022-era vs current | 2026-09-27 | MEDIUM (contradictory) | Treat node-reward rules as UNCLEAR; do not assert a reward formula in any app or report. |

### C.3 Community reports

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| CGNAT blocks inbound connections; no official workaround. | https://github.com/pi-node/instructions#528 | Community | undated | 2026-09-27 | MEDIUM | Documented environment limitation for node tests. |
| Missed protocol upgrades cause lost validation rewards (press). | (press reports) | Media | undated | 2026-09-27 | MEDIUM | Incentivizes auto-update; treat upgrade compliance as operationally critical. |

---

## D. Developer Ecosystem

### D.1 Current official policy

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Developer Portal: pi://develop.pinet.com (in Pi Browser; Develop icon). Register: App Name, Description, App Network (Mainnet or Testnet — IMMUTABLE). Yields Server API Key + app wallet; "never include API key in client-side code". | https://developers.minepi.com/ | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | App-network choice is immutable at registration; key-handling rule is absolute. |
| Sandbox: Pi.init({version:"2.0", sandbox:true}) at https://sandbox.minepi.com, authorized via Pi app → Pi Utilities → "Authorize Sandbox". | https://developers.minepi.com/ | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | Sandbox is the sanctioned test surface for SDK flows. |
| Pi Testnet tokens are NOT real; faucet available. | https://developers.minepi.com/ | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | Testnet balance figures have no value; do not extrapolate. |
| Mainnet launch path: create Mainnet app → verify app URL → generate app-wallet keypair → apply for Incoming Multisig Wallet (U2A, CT review "can take time") → A2U needs separate Outgoing Wallet ("currently available only for testnet apps and selected mainnet apps"). | https://developers.minepi.com/ | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | A2U on mainnet is gated; Outgoing Wallet availability is restricted. |
| Mainnet listing criteria: fully functional app + professional UI; developer KYC; no trademark violations — app URL/domain must NOT start with "pi"; Pi Authentication SDK only; Pi-only transactions; no external redirection; minimal data collection. | https://developers.minepi.com/ ; https://minepi.com/pi-trademark-guidelines/ | Pi Project Inc. / Pi Core Team | undated | 2026-09-27 | VERIFIED | "Pi"-prefixed domains are prohibited; Pi-only transactions rule out external payment rails. |
| Trademark: "Pi" in app/domain/social name requires Trademark Licensing Agreement; only permissible forms "App_Name for Pi" / "App_Name on Pi". | https://minepi.com/pi-trademark-guidelines/ | Pi Core Team | undated | 2026-09-27 | VERIFIED | Naming must follow the two permissible forms or secure a licence. |
| Domain validation: host validation-key.txt. | https://developers.minepi.com/ | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | URL verification is a file-hosting requirement, not just DNS. |
| Payments flow: Pi.createPayment → onReadyForServerApproval(paymentId) → POST /v2/payments/{id}/approve → user signs → onReadyForServerCompletion(paymentId, txid) → POST /v2/payments/{id}/complete {txid}; deliver goods ONLY after /complete returns non-error. | https://developers.minepi.com/docs/api-reference/PlatformAPI ; https://sdk.minepi.com/pi-sdk.js | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | The complete-with-txid step is the settlement boundary; fulfilment logic must gate on it. |
| Ads: interstitial / rewarded / banner; banner NOT in SDK; display open to all apps; MONETISATION requires Pi Core Team approval via portal; rewarded ads verify via GET /ads_network/status/:adId, reward only if mediator_ack_status === "granted". | https://developers.minepi.com/ | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | Rewarded-ad payouts must be gated on mediator_ack_status === "granted". |
| SDK v2.0: authenticate (scopes username/payments/wallet_address), createPayment + 4 callbacks, nativeFeaturesList, openShareDialog, Ads module, openUrlInSystemBrowser. | https://sdk.minepi.com/pi-sdk.js | Pi Project Inc. | undated | 2026-09-27 | VERIFIED | SDK surface is defined; test against sandbox with these methods only. |
| PiOS license for ecosystem apps; Pi App Studio (GenAI no-code builder). | https://developers.minepi.com/ ; https://github.com/pi-apps | Pi Project Inc. | undated | 2026-09-27 | HIGH | Ecosystem apps require PiOS licence; Pi App Studio is a separate no-code path. |
| Developer support: Atlassian portal support.help.minepi.com (Developers/Pi Apps Platform form id 20; Bug Report form id 10; Scam Report id 16). | https://support.help.minepi.com | Pi Core Team | undated | 2026-09-27 | VERIFIED | Bug reports go to form id 10; there is NO security-specific form. |
| Developer ToS (socialchain.app/developer_terms, last update 2023-01-09): §4 prohibits reverse engineering, hacking systems, scripting/unintended use. | https://socialchain.app/developer_terms | SocialChain Inc. | updated 2023-01-09 | 2026-09-7 | VERIFIED | No documented safe harbour; ToS §4 is a real constraint on any testing. |

### D.2 Historical announcements

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Pi Day 2026: protocol 20 foundation (2026-03); subscriptions prioritized; audit→review→testnet→mainnet. | https://minepi.com/blog/pi-day-2026/ | Pi Core Team | 2026-03 | 2026-09-27 | HIGH | Smart-contract work is gated by a staged pipeline. |
| Second migrations since Pi Day 2026 (2026-03-26); 119k+ done; referral bonuses included for KYC'd Referral Team members. | https://minepi.com/blog/second-migrations/ | Pi Core Team | 2026-03-26 | 2026-09-27 | HIGH | Live migration wave with referral-bonus material. |
| Fast Track KYC announcement (2025-09-18): <30 sessions; wallet activation, NOT migration. | https://minepi.com/announcement/fast-track-kyc/ | Pi Core Team | 2025-09-18 | 2026-09-27 | HIGH | Fast-Track wallet state is distinct from full KYC. |
| Fast-Track wallet gas-fee fix deployed week of 2026-09-17 (497k affected). | https://minepi.com/blog/kyc-mainnet-migration-9-26/ | Pi Core Team | 2026-09-17 | 2026-09-27 | HIGH | Live incident; monitor for follow-ups. |
| RPC server announcement (2026-04-08): rpc.testnet.minepi.com, JSON-RPC getHealth, reads free, Testnet only. | https://minepi.com/blog/rpc-server/ | Pi Core Team | 2026-04-08 | 2026-09-27 | HIGH | Testnet RPC is the free read path. |

### D.3 Directly observed behaviour

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| SDK served at sdk.minepi.com/pi-sdk.js. | https://sdk.minepi.com/pi-sdk.js | Pi Project Inc. | live | 2026-09-27 | VERIFIED | SDK can be loaded directly; version is current. |
| No security.txt on developers.minepi.com (404). | https://developers.minepi.com/.well-known/security.txt | — | checked 2026-09-27 | 2026-09-27 | VERIFIED | Use form id 10 for any bug report. |

---

## E. Earning Mechanisms

### E.1 Current official policy

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| KYC validator rewards exist; round 1 PAID: 16,568,774 Pi + 10M Pi Foundation sponsorship ÷ 526,970,631 validations = 0.0504179 Pi/validation (~21× base mining); 1,094,680 validators; 18M identities verified; ≥50 validations required; paid to Mainnet wallets. | https://minepi.com/blog/kyc-validator-rewards/ | Pi Core Team | 2026-04-03 | 2026-09-27 | HIGH | Validator reward is a real, paid earning stream; ≥50-validation threshold matters for eligibility. |
| Ecosystem Directory Staking (Pi2Day 2025): stake Pi to boost app ranking/visibility; explicitly "no Pi rewards on the protocol level for the staking"; principal returned after duration; individual devs may offer own incentives. | https://minepi.com/blog/pi2day2025/ | Pi Core Team | updated 2026-05-28 | 2026-09-27 | HIGH | Staking is a visibility mechanism, not a yield mechanism; do not advertise rewards. |
| Mobile mining boosts: Security Circle +20% each (max 5), Referral Team +25% each concurrent, lockups, app-usage, node rewards; rate declines monthly. | https://minepi.com/support/ | Pi Core Team | undated | 2026-09-27 | HIGH | Boost rates are not fixed; monthly decay is built in. |
| Pi Network Ventures: $100M fund (VC equity, not grants); gaming is a priority sector. | https://minepi.com/ (Ventures materials) | Pi Core Team | undated | 2026-09-27 | HIGH | Funding is equity-based; "grants" framing is incorrect. |
| Incubator: 2024 cohort done; no next announcement. | https://minepi.com/ (Incubator materials) | Pi Core Team | 2024 | 2026-09-27 | MEDIUM | No active incubator pipeline is announced. |
| Hackathon 2025 completed: 2025-08-15 → 2025-10-15; 160,000 Pi total (1st 75k, 2nd 45k, 3rd 15k, 5× mentions 5k); winners announced 2025-12-11. | https://minepi.com/ (Hackathon materials) | Pi Core Team | 2025-12-11 | 2026-09-27 | HIGH | 2025 hackathon is closed; do not cite it as active. |

### E.2 Unknowns

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Monthly #PiHackathon page says "ongoing" but 2026 continuation NOT verified. | https://minepi.com/ (monthly hackathon page) | Pi Core Team | undated | 2026-09-27 | LOW | Do not treat the "ongoing" label as a 2026 continuation; verify before relying. |

---

## F. Security & Responsible Disclosure Posture

### F.1 Current official policy / observed posture

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| No security.txt on minepi.com / pinet.com / api.minepi.com / developers.minepi.com / socialchain.app (all 404, checked 2026-09-27). | (paths above) | — | checked 2026-09-27 | 2026-09-27 | VERIFIED | No .well-known channel for disclosure. |
| No SECURITY.md in pi-apps repos or org policy. | https://github.com/pi-apps | Pi Project Inc. | checked 2026-09-27 | 2026-09-27 | VERIFIED | No repo-level disclosure policy. |
| General bug-report form: https://support.help.minepi.com/servicedesk/customer/portal/1/create/10 | https://support.help.minepi.com | Pi Core Team | undated | 2026-09-27 | VERIFIED | This is the only general bug-report channel. |
| No security/vulnerability-specific form. | https://support.help.minepi.com | Pi Core Team | checked 2026-09-27 | 2026-09-27 | VERIFIED | Security reports must be routed through the general form (form id 10). |
| hackerone.com/pi → 403 Cloudflare (not verifiable). | https://hackerone.com/pi | HackerOne | checked 2026-09-27 | 2026-09-27 | VERIFIED (observation) | Cannot confirm a HackerOne program exists. |
| No bounty-platform links on any first-party page. | (site-wide) | — | checked 2026-09-27 | 2026-09-27 | VERIFIED | No public bounty programme is advertised. |
| Safety Center lists official email domains: @pi.email, @picoreteam.org, @minepi.com. | https://minepi.com/ (Safety Center) | Pi Core Team | undated | 2026-09-27 | HIGH | Phishing/responsible-disclosure verification should reference only these domains. |
| Developer ToS §4 prohibits reverse engineering, hacking systems, scripting/unintended use — no documented safe harbour. | https://socialchain.app/developer_terms | SocialChain Inc. | updated 2023-01-09 | 2026-09-27 | VERIFIED | Testing must stay within ToS boundaries; no safe harbour is documented. |
| Copycat confirmed: pinet-pi.info (lookalike, not linked from official). pi-blockchain-explorer.pinet.com does NOT exist. | (prior research) | — | 2026-09-27 | 2026-09-27 | VERIFIED | Only the official domain list at the top of this document is trusted. |

### F.2 Hypotheses / Unknowns

| Claim | URL | Publisher | Pub/Update | Retrieved | Confidence | Practical consequence |
|---|---|---|---|---|---|---|
| Whether a public paid bug bounty with Pi payouts exists. | (none found) | — | — | 2026-09-27 | HYPOTHESIS | Not verified; private programme cannot be excluded. |
| Whether the general bug-report form (id 10) accepts security reports meaningfully. | https://support.help.minepi.com | Pi Core Team | undated | 2026-09-27 | HYPOTHESIS | No dedicated security channel exists; outcomes for security reports are undocumented. |

---

## X. Stale / Contradictory Flags

| Flag | Sources | Status | Action |
|---|---|---|---|
| Global grace-period deadline 2025-03-14 08:00 UTC is EXPIRED. Individual timers (with pauses/top-ups) are the operative concept, not the global date. | https://minepi.com/blog/grace-period-extension-mar-14 ; https://minepi.com/blog/kyc-grace-period/ | STALE as a user deadline | Never present 2025-03-14 as the user's individual deadline (see BALANCE_ACTIONS.md §3). |
| minepi.com/pi-node/ is 2022-era, self-disclaimed. Linux-node page is current. | https://minepi.com/pi-node/ ; https://minepi.com/pi-blockchain/pi-node/linux/ | STALE page | Use pi-blockchain/pi-node/Linux/ for current install/CLI truth. |
| Node rewards: FAQ vs Linux-node post contradiction (see C.2). | https://minepi.com/pi-node/ ; https://minepi.com/pi-blockchain/pi-node/linux/ | CONTRADICTORY | Treat reward rules as unclear; do not assert a formula. |
| SMS 2FA replaced by email 2FA; migration paused then resumed. | https://minepi.com/blog/update-on-mainnet-migration-and-account-verification | STALE (SMS) | Use email 2FA in any migration test. |
| Transferable Balance is a pessimistic estimate, not on-chain truth. | https://minepi.com/blog/mainnet-migrations-roadmap-and-tokenomics/ | ACTUAL POLICY | Dashboard transferable ≠ migratable amount (see BALANCE_ACTIONS.md §1). |
| Monthly #PiHackathon "ongoing" label vs unverified 2026 continuation. | https://minepi.com/ (monthly hackathon page) | UNVERIFIED | Do not rely on 2026 continuation. |
| Min-balance reserve amount (~1 Pi) is community-sourced, not official. | https://minepi.com/support/ | UNVERIFIED | Do not hardcode. |

---

## Y. Unknowns (explicit)

1. **Public paid bug bounty existence:** No evidence found of a public bounty programme with Pi payouts; a private programme cannot be excluded. Do not assume either way.
2. **Security-report triage:** No dedicated security form exists; outcomes for security reports submitted via form id 10 are undocumented.
3. **Node-reward rules:** Contradictory official statements (FAQ vs Linux-node post) — treat as unclear.
4. **Min-balance reserve amount:** Existence confirmed; exact amount not officially stated (~1 Pi is community-only).
5. **2026 hackathon continuation:** "ongoing" label on monthly page; 2026 continuation not verified.
6. **Per-user Grace Period timer values:** App-side, not public; cannot be retrieved via API or any documented channel.
7. **Whether any bug-bounty/app project has a contractual or programme relationship with Pi Core Team:** Not established in this research.

---

*Document generated 2026-09-27. All retrieval dates 2026-09-27. No URLs fabricated. Separates VERIFIED / HIGH / MEDIUM / LOW / HYPOTHESIS per row.*

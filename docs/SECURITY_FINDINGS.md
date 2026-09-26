# Pi Network — Security-Research Eligibility Findings

_Investigation date: 2026-09-27. Scope: establishing whether any authorised
security-testing programme exists. This document does NOT authorise any testing
against Pi systems._

## 1. Channels — reported separately (do not conflate)

### 1. General bug-report channel — EXISTS (verified)

- **Atlassian Jira Service Management portal** (project PINETWORK):
  `https://support.help.minepi.com/servicedesk/customer/portal/1/create/10`
  ("Bug Report", id 10; also `/group/3/create/10`).
- Fields: Pi username, common-bug radio list, device/OS/country/datetime,
  description, screenshots.
- Other forms: Developers/Pi Apps Platform (id 20), Scam Report (id 16),
  Wallet & Browser (id 23), KYC, Node, Mining & Balance, etc.
- **No security/vulnerability-specific request type exists** (full public
  request-type list checked on 2026-09-27).

### 2. Security-disclosure channel — NOT FOUND

- `/.well-known/security.txt` → **404** on minepi.com, pinet.com,
  api.minepi.com, developers.minepi.com, socialchain.app.
- `SECURITY.md` → **404** in github.com/pi-apps repos checked:
  pi-platform-docs (master), PiOS (main), demo (master), pi-node (master+main).
- No org-level policy (github.com/pi-apps/security/policy → 404).
- Safety Center (minepi.com/safety/) lists official channels only; official
  email **domains**: @pi.email, @picoreteam.org, @minepi.com. **No security@ or
  disclosure address is published anywhere.**
- Youth-safety page publishes a CSAE contact email behind Cloudflare email
  protection (obscured) — that is child-safety, not vulnerability disclosure.

### 3. Authorised testing programme — NOT FOUND (no safe harbour)

- **Developer Terms of Use** (socialchain.app/developer_terms, last update
  **2023-01-09**) §4 prohibits: reverse engineering Pi resources, "hacking any
  of Our systems or processes", "any unintended purpose or scripting".
- **No safe-harbour language is documented** on any primary source.
- Until written scope is established: active security tests are confined to
  our own code, local fixtures, and environments we control.

### 4. Paid bounty programme — NOT VERIFIED

- `hackerone.com/pi` → **HTTP 403 (Cloudflare)** — cannot confirm or deny.
- Web searches surfaced **no** Pi Network program on HackerOne, Bugcrowd, or
  Intigriti. (Note: "Pi" on Bugcrowd is *pi.security*, an unrelated AI
  product-security company — name confusion, no connection to minepi.com.)
- No bounty-platform link appears on any first-party page.
- **Whether a public paid bug bounty with Pi payouts exists: NOT VERIFIED.**
  No evidence found on any primary source; a private programme cannot be
  excluded. Researcher eligibility, in-scope assets, automation restrictions,
  reward criteria, payout currency: **all unpublished/unknown**.

## 2. What this means for good-faith research

| Question | Answer |
|---|---|
| Is there a public bug bounty with Pi payouts? | Not verified — no evidence; private programme cannot be excluded |
| Is there a published disclosure policy? | None found |
| Is there safe-harbour language? | None documented; ToS §4 prohibits hacking/reverse engineering |
| Closest thing to paid security engagement? | Hackathon 2025 (160,000 Pi prizes, completed); no 2026 edition announced |
| Safest public reporting path today? | Bug Report form (create/10) with evidence attached; in-app "Report suspicious activity"; Safety Center channels |

## 3. DRAFT inquiry — DO NOT SEND WITHOUT APPROVAL

_To: Pi Network support (via the Atlassian Support Portal — no verified security
email exists; do not invent addresses)._ From: an independent security researcher
based in India.

> Subject: Inquiry — vulnerability disclosure scope and researcher eligibility
>
> Hello,
>
> I am an independent security researcher based in India. I am studying the
> security of Pi's public web properties and developer platform in good faith,
> and I want to ensure any testing I do — now or in the future — is within
> bounds you explicitly authorise.
>
> Could you clarify:
> 1. **Eligibility** — who may conduct security research on Pi systems, and
>    are researchers based in India eligible?
> 2. **Authorised assets/environments** — which assets (domains, apps, APIs)
>    are in scope for testing, and which are excluded?
> 3. **Permitted testing & automation** — what techniques are allowed, and are
>    there rate/automation restrictions?
> 4. **Good-faith protections** — is there any safe-harbour or authorised-
>    testing statement that protects good-faith research from the Developer
>    Terms' prohibition on "hacking"/scripting?
> 5. **Private reporting procedure** — is there a private channel for
>    vulnerability reports (the public portal has no security-specific form)?
> 6. **Rewards** — is there a vulnerability reward programme? If so, are
>    rewards discretionary, and are they paid in native Pi?
>
> I will not begin any testing until I have written confirmation of scope.
> Thank you for your time.

**Status: DRAFT — not sent. No address invented (portal form only).**

## 4. Standing rules for this project

1. No active testing against Pi production services (no authorised scope).
2. Local source review of public repos + public-documentation research only.
3. If a verified programme is ever found: document its exact rules and propose
   a separate scoped research plan before any testing.
4. Our own game/backend: full local testing authorised and performed
   (see RUNBOOK.md §4).

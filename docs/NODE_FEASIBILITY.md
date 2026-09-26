# Pi Node — Feasibility & Setup Assessment

_Date: 2026-09-27 | Machine: CYPHERDOME (headless Ubuntu desktop)_

## 1. Verdict

**A Pi Mainnet node is NOT currently feasible on this machine.** The blocker is
disk space, not CPU/RAM/connectivity. Do **not** start the node until ~150 GB is
freed by a conscious user decision (see §5). Nothing was installed or changed.

## 2. Environment inspection (actual, 2026-09-27)

| Resource | Available | Node requirement (official) | OK? |
|---|---|---|---|
| Disk (`/`, nvme0n1p7) | **2.7 GB free / 187 GB (99% full)** | **150 GB min, 300 GB ideal** | ❌ **BLOCKED** |
| CPU | Ryzen 9 9900X, 12C/24T | 4 vCPUs | ✅ |
| RAM | 30 GB total, ~17 GB available | 4 GB | ✅ |
| GPU | RTX 4070 SUPER 12 GB | irrelevant to Pi node | — (no effect on rewards) |
| OS | Ubuntu 24.04.5 LTS x64 | Ubuntu 24.04 suggested | ✅ |
| Outbound net | working ( Horizon API reachable ) | required | ✅ |
| Inbound | native IPv6 `2401:4900:…` + Tailscale `100.125.204.16` | port-openability is a selection criterion | ⚠️ unverified |

**Disk consumers (top, measured):** `local-ai-bounty` 13 GB, `zoho_bb` 5.8 GB,
`powerdns-bb` 3.5 GB, `tools` 2.9 GB, `nepal-2026-debris-reconstruction` 2.9 GB,
`dovecot-bb` 2.9 GB, `go` 2.7 GB, `manus-vault` 2.5 GB, `ifa` 2.5 GB — plus ~221
directories under `/home/parzival`. Docker: 25 images (9.6 GB, 1.3 GB reclaimable),
21 running containers (supabase, morphia, ctfarena stacks — **do not touch**).

## 3. Existing `~/pi-node/` assessment

- Contains `docker-compose.yml` referencing `pinetwork/pi-node-docker:organization-mainnet-v1.0-p21.2`
  and an `.env` (keys only: `POSTGRES_PASSWORD`, `DATABASE_URL`, `NETWORK_PASSPHRASE`,
  `NODE_PRIVATE_KEY`). Volumes are **empty (252 KB)** — the node never ran here.
- That April-2026 compose file is **outdated**: the current official install path
  (verified 2026-09-27, minepi.com/pi-blockchain/pi-node/linux/) is the
  `apt.minepi.com` APT repository + `pi-node` CLI package:
  ```
  # GPG key + source (official URLs only)
  curl -fsSL https://apt.minepi.com/repository.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/pi-node.gpg
  echo "deb [signed-by=/usr/share/keyrings/pi-node.gpg] https://apt.minepi.com noble main" | sudo tee /etc/apt/sources.list.d/pi-node.list
  sudo apt-get update && sudo apt-get install pi-node
  pi-node initialize   # or upgrade path reusing existing NODE_SEED / volumes
  pi-node start|stop|restart|status|logs -f|update-protocol
  ```
  Docker + Docker Compose v2 remains supported by the same page.
- **Provenance rule followed:** only URLs linked from `minepi.com` were used; the
  existing compose was *not* run (old image tag, empty volumes, 2.7 GB free disk).

## 4. Reward eligibility — honest state (contradictory sources)

- Support FAQ: node rewards "open to any Pioneer with a computer connected to
  the internet… computed based on the reliability and accessibility of the Node".
- Linux-node announcement (2025-08-27): the Linux node is "not directly tied to
  Node rewards".
- Press (2026-05): nodes missing mandatory protocol upgrades lose validation
  rewards. Upgrades have hard deadlines (v27 live 2026-09-26; v28 in progress).
- Mainnet onboarding is invitation-gated by reliability (anyone can *technically*
  add a node).
→ **Do not assume any node income.** Treat node operation as experimental
infrastructure with possible zero reward until Pi publishes a consistent,
current eligibility rule.

## 5. What must happen first (user decision required)

1. **Free ~150 GB** on `/`. Options (your call — no unrelated files were deleted):
   - Prune/relocate the largest directories listed in §2 (archives, old bounty
     folders, VM images). Docker reclaimable space is only ~1.3 GB.
   - Add a second drive and relocate data (node data on its own volume is ideal).
2. **Verify account linkage** — a node logs in via the Pi mobile app; one Pi
   account = one node. Check in the Pi app whether your account is invited to
   run a Mainnet node (desktop UI invitation) — this is account-gated.
3. **Connectivity** — if behind CGNAT on IPv4, inbound peer connections may
   fail; native IPv6 presence is favorable. No router/firewall changes were made
   (boundary). The node needs inbound reachability for full reliability score.
4. **Keep the RTX 4070 out of the economics** — Pi node consensus is CPU/disk
   bound; the GPU does not increase node earnings.

## 6. Electricity model (labelled assumption)

```
incremental cost/day = (measured extra watts / 1000) × 24 h × tariff (₹/kWh)
```
- Assumption: a headless Ryzen 9 node adds ~40–80 W wall draw vs idle (measure
  with a meter; 60 W labelled assumption).
- Tariff: Tamil Nadu domestic TNEB ≈ ₹6–8/kWh (user must confirm current slab).
- Example at 60 W, ₹7/kWh: 0.06 kW × 24 × 7 = **₹10.1/day ≈ ₹303/month**.
- **Zero-rewards case included: this cost is real even if node rewards are 0.**

## 7. Prepared (but not executed) runbook — once disk + eligibility are settled

- Install via `apt.minepi.com` (§3); keep `pi-node` updated (`update-protocol`).
- Run in Docker with a dedicated volume on the freed space; never expose the
  local management port (11626) publicly.
- Monitoring: `pi-node status/logs -f`; track sync vs
  `https://api.mainnet.minepi.com/` (`/ledgers?order=desc&limit=1`), uptime,
  disk growth (`df -h`), and log rotation (Docker `logrotate` or
  `--log-opt max-size`).
- Resource limits: 4 vCPU / 4 GB RAM cap via Docker; restart `unless-stopped`.
- Rollback: `docker compose down` + remove the dedicated volume; no other
  services affected.
- Rewards are only visible in the Pi mobile app → keep explicitly labelled
  manual records (date, app-reported bonus, tx evidence) if enabled.

## 8. Node Challenge (our game) ≠ Pi Node

The in-game "Node Challenge" is a **local deterministic re-simulation verifier**
running on the game server. It is not Pi blockchain validation, not a Pi Node,
and earns no Pi. Do not conflate the two.

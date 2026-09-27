#!/usr/bin/env bash
#
# https-testnet.sh — expose the local Pi Runner server over HTTPS for Pi Browser
# Testnet validation, using the Tailscale that is already installed on this host.
#
# It exposes ONLY the app port (3000) over TLS. No other local service is
# published, TLS verification is never weakened, and teardown is one command.
#
#   Tailnet-only (default, safest):  ./scripts/https-testnet.sh serve
#       Reachable only by your own tailnet devices (e.g. your phone running
#       Tailscale). Best when your phone is on the tailnet.
#
#   Public (only if Pi's portal needs a publicly-resolvable URL):
#                                    ./scripts/https-testnet.sh funnel
#       Publishes the SAME single app port to the public internet over HTTPS.
#
#   Status / teardown:
#                                    ./scripts/https-testnet.sh status
#                                    ./scripts/https-testnet.sh down
#
# Prereq (one-time OPERATOR action, in the Tailscale admin console):
#   1. Enable MagicDNS + HTTPS certificates for the tailnet
#        https://login.tailscale.com/admin/dns  ->  "Enable HTTPS…"
#   2. For `funnel` only: allow Funnel for this node in the ACL policy
#        ("nodeAttrs" -> "funnel"). See https://tailscale.com/kb/1223/funnel
#
set -euo pipefail

PORT="${PORT:-3000}"
CMD="${1:-serve}"

need_tailscale() {
  command -v tailscale >/dev/null 2>&1 || { echo "ERROR: tailscale not installed."; exit 1; }
  tailscale status >/dev/null 2>&1 || { echo "ERROR: tailscale is down. Run: sudo tailscale up"; exit 1; }
}

dns_name() {
  tailscale status --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write((j.Self.DNSName||"").replace(/\.$/,""))})'
}

check_https_enabled() {
  local host; host="$(dns_name)"
  if ! tailscale cert "$host" >/tmp/.ts-cert-check 2>&1; then
    if grep -qi 'not enabled' /tmp/.ts-cert-check; then
      echo "OPERATOR ACTION REQUIRED: tailnet HTTPS is not enabled yet."
      echo "  Enable it at https://login.tailscale.com/admin/dns (MagicDNS + HTTPS certificates),"
      echo "  then re-run this script. Nothing was changed."
      exit 2
    fi
  fi
}

app_up() {
  curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1
}

case "$CMD" in
  serve|funnel)
    need_tailscale
    if ! app_up; then
      echo "WARNING: no server answering on http://127.0.0.1:${PORT}/api/health"
      echo "  Start it first in another shell:  cd ~/pi-runner && npm start"
    fi
    check_https_enabled
    host="$(dns_name)"
    if [ "$CMD" = "funnel" ]; then
      echo "Publishing app port ${PORT} PUBLICLY over HTTPS via Tailscale Funnel…"
      sudo tailscale funnel --bg --https=443 "http://127.0.0.1:${PORT}"
    else
      echo "Serving app port ${PORT} to the tailnet over HTTPS via Tailscale serve…"
      sudo tailscale serve --bg --https=443 "http://127.0.0.1:${PORT}"
    fi
    echo
    echo "HTTPS URL for the Pi Developer Portal + Pi Browser:"
    echo "    https://${host}"
    echo
    echo "Teardown when done:  ./scripts/https-testnet.sh down"
    ;;
  status)
    need_tailscale
    echo "== tailscale serve status =="; tailscale serve status 2>&1 || true
    echo "== tailscale funnel status =="; tailscale funnel status 2>&1 || true
    echo "== app health =="; app_up && echo "app: UP on :${PORT}" || echo "app: not responding on :${PORT}"
    ;;
  down)
    need_tailscale
    echo "Removing all serve/funnel config for this node…"
    sudo tailscale serve reset 2>/dev/null || true
    sudo tailscale funnel reset 2>/dev/null || true
    echo "Done. Nothing is exposed."
    ;;
  *)
    echo "Usage: $0 {serve|funnel|status|down}"; exit 1;;
esac

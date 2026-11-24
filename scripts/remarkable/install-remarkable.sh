#!/usr/bin/env bash
# One-command SSH installer for the reMarkable 2 Dynamic Sleep Screen
# Usage: bash scripts/remarkable/install-remarkable.sh <REMARKABLE_IP> [INTERVAL_MINUTES] [DASHBOARD_URL]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_REFRESH_SCRIPT="$SCRIPT_DIR/rm2-refresh.sh"

RM_IP="${1:-}"
INTERVAL_MINS="${2:-2}"
DASHBOARD_URL="${3:-https://ambient-dashboard-henry-seven.vercel.app}"
PNG_URL="${DASHBOARD_URL%/}/api/remarkable?device=rm2"

if [[ -z "$RM_IP" ]]; then
  echo "=== Ambient Dashboard — reMarkable 2 Sleep Screen Installer ==="
  echo ""
  echo "Usage:"
  echo "  npm run setup:remarkable -- <REMARKABLE_IP> [INTERVAL_MINUTES]"
  echo ""
  echo "Example:"
  echo "  npm run setup:remarkable -- 192.168.1.45 2"
  echo ""
  echo "Where to find your reMarkable 2 IP & root password:"
  echo "  Settings -> Help -> Copyrights and licenses -> General information (bottom of page)"
  exit 1
fi

echo "=== Installing Ambient Dashboard Sleep Screen to root@${RM_IP} ==="
echo "  • Source PNG URL : ${PNG_URL}"
echo "  • Refresh Every  : ${INTERVAL_MINS} minute(s)"
echo ""

scp "$LOCAL_REFRESH_SCRIPT" "root@${RM_IP}:/home/root/ambient-remarkable-refresh.sh"

ssh "root@${RM_IP}" "cat > /etc/systemd/system/ambient-remarkable.service <<'EOF'
[Unit]
Description=Ambient Dashboard reMarkable 2 Sleep Screen Updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=\"DASHBOARD_PNG_URL=${PNG_URL}\"
ExecStart=/bin/sh /home/root/ambient-remarkable-refresh.sh
EOF

cat > /etc/systemd/system/ambient-remarkable.timer <<'EOF'
[Unit]
Description=Periodic refresh for Ambient Dashboard reMarkable 2 Sleep Screen

[Timer]
OnBootSec=30s
OnUnitActiveSec=${INTERVAL_MINS}m
AccuracySec=15s
Persistent=true

[Install]
WantedBy=timers.target
EOF

chmod +x /home/root/ambient-remarkable-refresh.sh
systemctl daemon-reload
systemctl enable --now ambient-remarkable.timer
systemctl start ambient-remarkable.service
"

echo ""
echo "✓ Installed and activated on reMarkable 2!"
echo "  • Sleep screen file : /usr/share/remarkable/suspended.png"
echo "  • Original backup   : /usr/share/remarkable/suspended.png.orig"
echo "  • Check timer logs  : ssh root@${RM_IP} 'journalctl -u ambient-remarkable.service -n 20'"

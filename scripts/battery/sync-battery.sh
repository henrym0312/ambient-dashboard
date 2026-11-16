#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
# Sync MacBook, Keyboard, Mouse, AirPods battery, and Now Playing media to Ambient Dashboard
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$HOME/.config/ambient-dashboard/reminders.env"

DASHBOARD_API_URL="https://ambient-dashboard-henry-seven.vercel.app"
CRON_SECRET="mySecretSyncKey123"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

NODE_BIN="$(command -v node || echo "/usr/local/bin/node")"
BATTERY_JSON=$("$NODE_BIN" "$SCRIPT_DIR/extract-battery.js")

if [[ "$BATTERY_JSON" == {* ]]; then
  curl -s -X POST "${DASHBOARD_API_URL%/}/api/battery" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -d "$BATTERY_JSON" > /dev/null
fi

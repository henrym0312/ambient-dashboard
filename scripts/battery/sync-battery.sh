#!/bin/bash
# Sync MacBook, Keyboard, Mouse, and AirPods battery to Ambient Dashboard
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BATTERY_JSON=$(node "$SCRIPT_DIR/extract-battery.js")

if [[ "$BATTERY_JSON" == {* ]]; then
  curl -s -X POST https://ambient-dashboard-seven.vercel.app/api/battery \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer mySecretSyncKey123" \
    -d "$BATTERY_JSON" > /dev/null
fi

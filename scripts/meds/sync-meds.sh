#!/usr/bin/env bash
set -euo pipefail

MEDS_FILE="$HOME/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/ADHD_Med_Log.json"
CONFIG_FILE="$HOME/.config/ambient-dashboard/reminders.env"
CACHE_DIR="$HOME/.cache/ambient-dashboard"
HASH_FILE="$CACHE_DIR/meds.md5"

mkdir -p "$CACHE_DIR"

if [[ ! -f "$MEDS_FILE" ]]; then
  exit 0
fi

DASHBOARD_API_URL="${DASHBOARD_API_URL:-https://ambient-dashboard-seven.vercel.app}"
CRON_SECRET="${CRON_SECRET:-}"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

if [[ -z "$CRON_SECRET" ]]; then
  echo "Error: CRON_SECRET not set" >&2
  exit 1
fi

CURRENT_HASH="$(md5 -q "$MEDS_FILE" 2>/dev/null || md5sum "$MEDS_FILE" | awk '{print $1}')"

# If not forced, skip if hash hasn't changed
if [[ "${1:-}" != "--force" && -f "$HASH_FILE" ]]; then
  PREV_HASH="$(cat "$HASH_FILE" 2>/dev/null || true)"
  if [[ "$CURRENT_HASH" == "$PREV_HASH" ]]; then
    exit 0
  fi
fi

RESPONSE="$(curl -s -w "\n%{http_code}" -X POST "${DASHBOARD_API_URL}/api/meds" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  --data-binary @"$MEDS_FILE")"

HTTP_CODE="$(echo "$RESPONSE" | tail -n 1)"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "$CURRENT_HASH" > "$HASH_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Synced ADHD medication log to dashboard (HTTP 200)"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to sync ADHD medication log (HTTP $HTTP_CODE)" >&2
  exit 1
fi

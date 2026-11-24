#!/bin/sh
# Runs on the reMarkable 2 (/home/root/ambient-remarkable-refresh.sh)
# Pulls a fresh 1404x1872 PNG from the Ambient Dashboard /api/remarkable endpoint
# and atomically updates /usr/share/remarkable/suspended.png.

set -eu

DASHBOARD_PNG_URL="${DASHBOARD_PNG_URL:-https://ambient-dashboard-henry-seven.vercel.app/api/remarkable?device=rm2}"
TARGET_PNG="/usr/share/remarkable/suspended.png"
BACKUP_PNG="/usr/share/remarkable/suspended.png.orig"
TMP_PNG="/tmp/ambient-suspended.png.tmp"

# Back up the original factory sleep screen once
if [ -f "$TARGET_PNG" ] && [ ! -f "$BACKUP_PNG" ]; then
  cp "$TARGET_PNG" "$BACKUP_PNG"
fi

# Download fresh PNG using curl or wget
if command -v curl >/dev/null 2>&1; then
  curl -fsSL --connect-timeout 10 --max-time 25 "$DASHBOARD_PNG_URL" -o "$TMP_PNG"
elif command -v wget >/dev/null 2>&1; then
  wget -q -T 25 -O "$TMP_PNG" "$DASHBOARD_PNG_URL"
else
  echo "Error: neither curl nor wget found on reMarkable" >&2
  exit 1
fi

# Verify file is non-empty (> 5 KB) and has a valid PNG header before replacing
if [ ! -s "$TMP_PNG" ]; then
  rm -f "$TMP_PNG"
  exit 1
fi

FILE_SIZE="$(wc -c < "$TMP_PNG" | tr -d ' ')"
if [ "$FILE_SIZE" -lt 5000 ]; then
  echo "Error: downloaded image too small ($FILE_SIZE bytes), skipping replace" >&2
  rm -f "$TMP_PNG"
  exit 1
fi

mv "$TMP_PNG" "$TARGET_PNG"
chmod 644 "$TARGET_PNG"
sync

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updated $TARGET_PNG ($FILE_SIZE bytes)"

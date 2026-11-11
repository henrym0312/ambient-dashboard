#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

BIN_DIR="$HOME/.local/bin"
BIN_PATH="$BIN_DIR/ambient-meds-sync"
CONFIG_DIR="$HOME/.config/ambient-dashboard"
CONFIG_FILE="$CONFIG_DIR/reminders.env"
CACHE_DIR="$HOME/.cache/ambient-dashboard"
PLIST_LABEL="com.henrymilner.ambient-meds"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

MEDS_FILE="$HOME/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/ADHD_Med_Log.json"

echo "=== Ambient Dashboard — ADHD Medication iCloud Watcher Installer ==="

mkdir -p "$BIN_DIR" "$CONFIG_DIR" "$CACHE_DIR" "$HOME/Library/LaunchAgents"

if [[ ! -f "$MEDS_FILE" ]]; then
  echo "⚠️ Warning: $MEDS_FILE not found yet on this Mac."
  echo "Make sure Scriptable has iCloud Drive enabled on your iPhone."
fi

cp "$SCRIPT_DIR/sync-meds.sh" "$BIN_PATH"
chmod +x "$BIN_PATH"
echo "✓ Installed sync script to $BIN_PATH"

# Write event-driven LaunchAgent that triggers whenever iCloud Drive updates ADHD_Med_Log.json
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$BIN_PATH</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>ThrottleInterval</key>
  <integer>2</integer>

  <key>StartInterval</key>
  <integer>300</integer>

  <key>WatchPaths</key>
  <array>
    <string>$MEDS_FILE</string>
  </array>

  <key>StandardOutPath</key>
  <string>$CACHE_DIR/meds-sync.log</string>

  <key>StandardErrorPath</key>
  <string>$CACHE_DIR/meds-sync.err.log</string>
</dict>
</plist>
EOF

# Reload LaunchAgent
launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo ""
echo "✓ Installed and started LaunchAgent: $PLIST_LABEL"
echo "  • Event-driven WatchPaths: Triggers within 2 seconds whenever Scriptable updates ADHD_Med_Log.json"
echo "  • Fallback heartbeat: Every 5 minutes"
echo "  • Logs: $CACHE_DIR/meds-sync.log"

# Run initial sync
echo ""
echo "Running initial sync..."
"$BIN_PATH" --force || true

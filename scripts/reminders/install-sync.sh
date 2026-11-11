#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SWIFT_SRC="$SCRIPT_DIR/reminders-sync.swift"

BIN_DIR="$HOME/.local/bin"
BIN_PATH="$BIN_DIR/ambient-reminders-sync"
CONFIG_DIR="$HOME/.config/ambient-dashboard"
CONFIG_FILE="$CONFIG_DIR/reminders.env"
CACHE_DIR="$HOME/.cache/ambient-dashboard"
PLIST_LABEL="com.henrymilner.ambient-reminders"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
OLD_PLIST="$HOME/Library/LaunchAgents/com.henry.remindersync.plist"

echo "=== Ambient Dashboard — Native EventKit Reminders Sync Installer ==="

mkdir -p "$BIN_DIR" "$CONFIG_DIR" "$CACHE_DIR" "$HOME/Library/LaunchAgents"

DASHBOARD_API_URL="${DASHBOARD_API_URL:-}"
CRON_SECRET="${CRON_SECRET:-}"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

# Auto-extract CRON_SECRET and URL from legacy com.henry.remindersync.plist if present
if [[ -f "$OLD_PLIST" ]]; then
  echo "Found legacy LaunchAgent: $OLD_PLIST"
  OLD_SCRIPT_PATH="$(grep -E -o '/Users/[^<"]+\.(sh|py|js|scpt|applescript)' "$OLD_PLIST" | head -n 1 || true)"
  if [[ -n "$OLD_SCRIPT_PATH" && -f "$OLD_SCRIPT_PATH" ]]; then
    echo "Inspecting legacy script: $OLD_SCRIPT_PATH"
    if [[ -z "$CRON_SECRET" ]]; then
      CRON_SECRET="$(grep -E -o 'Bearer [A-Za-z0-9_.-]+' "$OLD_SCRIPT_PATH" | head -n 1 | awk '{print $2}' || true)"
      if [[ -z "$CRON_SECRET" ]]; then
        CRON_SECRET="$(grep -E 'CRON_SECRET|SECRET|TOKEN' "$OLD_SCRIPT_PATH" | grep -E -o '["'\''][A-Za-z0-9_.-]+["'\'']' | head -n 1 | tr -d '"' | tr -d "'" || true)"
      fi
    fi
    if [[ -z "$DASHBOARD_API_URL" ]]; then
      DASHBOARD_API_URL="$(grep -E -o 'https://[a-zA-Z0-9.-]+\.vercel\.app' "$OLD_SCRIPT_PATH" | head -n 1 || true)"
    fi
  fi
fi

if [[ -f "$REPO_DIR/.env.local" ]]; then
  if [[ -z "$DASHBOARD_API_URL" ]]; then
    DASHBOARD_API_URL="$(grep -E '^DASHBOARD_(API_)?URL=' "$REPO_DIR/.env.local" | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)"
  fi
  if [[ -z "$CRON_SECRET" ]]; then
    CRON_SECRET="$(grep -E '^CRON_SECRET=' "$REPO_DIR/.env.local" | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)"
  fi
fi

if [[ -z "$DASHBOARD_API_URL" ]]; then
  read -r -p "Enter your deployed Vercel Dashboard URL [https://ambient-dashboard-seven.vercel.app]: " INPUT_URL
  DASHBOARD_API_URL="${INPUT_URL:-https://ambient-dashboard-seven.vercel.app}"
else
  echo "✓ Detected Dashboard URL: $DASHBOARD_API_URL"
fi

if [[ -z "$CRON_SECRET" ]]; then
  read -r -p "Enter your CRON_SECRET (visible as you paste): " CRON_SECRET
else
  echo "✓ Automatically extracted CRON_SECRET from your existing setup"
fi

cat > "$CONFIG_FILE" <<EOF
DASHBOARD_API_URL="$DASHBOARD_API_URL"
CRON_SECRET="$CRON_SECRET"
EOF
chmod 600 "$CONFIG_FILE"
echo "✓ Saved credentials to $CONFIG_FILE"

# Unload and remove the old com.henry.remindersync.plist so it no longer runs
if [[ -f "$OLD_PLIST" ]]; then
  echo "Stopping and removing legacy com.henry.remindersync.plist..."
  launchctl bootout "gui/$(id -u)/com.henry.remindersync" 2>/dev/null || launchctl unload "$OLD_PLIST" 2>/dev/null || true
  rm -f "$OLD_PLIST"
  echo "✓ Removed legacy com.henry.remindersync.plist"
fi

# Compile native Swift EventKit binary
echo "Compiling native Swift EventKit binary..."
swiftc -O -module-cache-path /tmp/swift-module-cache "$SWIFT_SRC" -o "$BIN_PATH"
chmod +x "$BIN_PATH"
echo "✓ Compiled $BIN_PATH"

# Test-run immediately (triggers macOS Reminders permission prompt on first run)
echo "Running initial sync (grant Reminders access if macOS prompts you)..."
"$BIN_PATH" --force

# Write event-driven LaunchAgent (WatchPaths on Reminders SQLite store + 15m heartbeat)
REMINDERS_STORE_DIR="$HOME/Library/LaunchAgents"
REMINDERS_SQLITE_DIR="$HOME/Library/Reminders/Container_v1/Stores"

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
  <integer>3</integer>

  <key>StartInterval</key>
  <integer>900</integer>

  <key>WatchPaths</key>
  <array>
    <string>$REMINDERS_SQLITE_DIR</string>
  </array>

  <key>StandardOutPath</key>
  <string>$CACHE_DIR/sync.log</string>

  <key>StandardErrorPath</key>
  <string>$CACHE_DIR/sync.err.log</string>
</dict>
</plist>
EOF

# Reload LaunchAgent
launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo ""
echo "✓ Installed and started LaunchAgent: $PLIST_LABEL"
echo "  • Event-driven WatchPaths: $REMINDERS_SQLITE_DIR (syncs ~3s after any Reminder change)"
echo "  • Heartbeat fallback: Every 15 minutes"
echo "  • Logs: $CACHE_DIR/sync.log"

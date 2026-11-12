#!/bin/bash
# Install LaunchAgent for background battery sync every 30 seconds
PLIST_PATH="$HOME/Library/LaunchAgents/com.henrymilner.ambient-battery.plist"
SCRIPT_PATH="$HOME/ambient-dashboard/scripts/battery/sync-battery.sh"

mkdir -p "$HOME/Library/LaunchAgents"

cat << EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.henrymilner.ambient-battery</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SCRIPT_PATH</string>
    </array>
    <key>StartInterval</key>
    <integer>30</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/ambient-battery.err</string>
    <key>StandardOutPath</key>
    <string>/tmp/ambient-battery.out</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"
echo "Installed and loaded com.henrymilner.ambient-battery (syncs every 30s)"

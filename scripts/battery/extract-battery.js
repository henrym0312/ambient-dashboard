/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync, execFileSync } = require('child_process');

function getMacBattery() {
  try {
    const out = execSync('pmset -g batt').toString();
    const pctMatch = out.match(/(\d+)%/);
    const percent = pctMatch ? parseInt(pctMatch[1], 10) : null;
    const isAC = out.includes('AC Power');
    const isDischarging = /\bdischarging\b/.test(out);
    const isCharging = isAC && !isDischarging && /\bcharging\b/.test(out);
    return {
      percent,
      charging: isCharging,
      powerSource: isAC ? 'AC' : 'Battery',
      name: 'MacBook Air',
    };
  } catch {
    return null;
  }
}

function getAppleMusic() {
  try {
    const isRunning = execSync('pgrep -x Music || true').toString().trim();
    if (!isRunning) return null;
    const script = `tell application "Music"
if player state is playing then
  return name of current track & "|||" & artist of current track & "|||" & album of current track
else
  return "PAUSED"
end if
end tell`;
    const res = execFileSync('osascript', ['-e', script], { timeout: 2500 }).toString().trim();
    if (res === 'PAUSED' || !res || res.includes('error')) return null;
    const [title, artist, album] = res.split('|||');
    return {
      title: title || 'Unknown Title',
      artist: artist || 'Unknown Artist',
      album: album || '',
      isPlaying: true,
    };
  } catch {
    return null;
  }
}

function getBluetoothDevices() {
  let keyboard = null;
  let mouse = null;
  let airpods = null;

  try {
    const raw = execSync('system_profiler SPBluetoothDataType -json', {
      maxBuffer: 10 * 1024 * 1024,
    }).toString();
    const data = JSON.parse(raw);
    const controllers = data.SPBluetoothDataType || [];
    for (const c of controllers) {
      const connected = c.device_connected || [];
      for (const item of connected) {
        const [devName, devInfo] = Object.entries(item)[0] || [];
        if (!devName || !devInfo) continue;

        // Keyboard
        if (
          devName.toLowerCase().includes('keyboard') ||
          devInfo.device_minorType === 'Keyboard'
        ) {
          const bMatch = (devInfo.device_batteryLevelMain || '').match(/(\d+)%/);
          keyboard = {
            name: devName,
            percent: bMatch ? parseInt(bMatch[1], 10) : 100,
          };
        }

        // Mouse
        if (
          devName.toLowerCase().includes('lift') ||
          devName.toLowerCase().includes('mouse') ||
          devInfo.device_minorType === 'Mouse'
        ) {
          const bMatch = (devInfo.device_batteryLevelMain || '').match(/(\d+)%/);
          mouse = {
            name: devName,
            percent: bMatch ? parseInt(bMatch[1], 10) : null,
          };
        }

        // AirPods
        if (
          devName.toLowerCase().includes('airpods') ||
          devInfo.device_minorType === 'Headphones'
        ) {
          const lMatch = (devInfo.device_batteryLevelLeft || '').match(/(\d+)%/);
          const rMatch = (devInfo.device_batteryLevelRight || '').match(/(\d+)%/);
          const cMatch = (devInfo.device_batteryLevelCase || '').match(/(\d+)%/);
          airpods = {
            name: devName,
            left: lMatch ? parseInt(lMatch[1], 10) : null,
            right: rMatch ? parseInt(rMatch[1], 10) : null,
            case: cMatch ? parseInt(cMatch[1], 10) : null,
          };
        }
      }
    }
  } catch (err) {
    console.error('BT inspect error:', err);
  }

  return { keyboard, mouse, airpods };
}

const payload = {
  macbook: getMacBattery(),
  ...getBluetoothDevices(),
  media: getAppleMusic(),
};

process.stdout.write(JSON.stringify(payload));

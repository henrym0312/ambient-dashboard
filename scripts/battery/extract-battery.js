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

function formatYouTubeTitle(raw, appName) {
  let clean = raw.replace(/\s*-\s*YouTube(?:\s*Music)?\s*$/i, '').trim();
  clean = clean.replace(/^\(\d+\)\s*/, '').trim();
  let artist = 'YouTube';
  let title = clean;
  const m = clean.match(/^(.+?)\s*[-–—:]\s*(.+)$/);
  if (m && m[1] && m[2] && m[1].length < 40) {
    artist = m[1].trim();
    title = m[2].trim();
  }
  return {
    title: title || 'YouTube Video',
    artist: artist || 'YouTube',
    album: appName || 'YouTube',
    isPlaying: true,
    source: 'youtube',
  };
}

function getChromiumMedia(appName, sourceName) {
  try {
    const isRunning = execSync(`pgrep -i "${appName.split(' ')[0]}" || true`).toString().trim();
    if (!isRunning) return null;
    const script = `tell application "${appName}"
  repeat with w in windows
    repeat with t in tabs of w
      set tTitle to title of t
      set tUrl to URL of t
      if tUrl contains "youtube.com/watch" or tTitle contains "- YouTube" or tUrl contains "music.youtube.com" then
        return tTitle & "|||" & tUrl
      end if
    end repeat
  end repeat
end tell`;
    const res = execFileSync('osascript', ['-e', script], { timeout: 2500 }).toString().trim();
    if (!res || res === 'missing value' || res.includes('error')) return null;
    const [rawTitle] = res.split('|||');
    return formatYouTubeTitle(rawTitle, sourceName);
  } catch {
    return null;
  }
}

function getSafariMedia() {
  try {
    const isRunning = execSync('pgrep -x Safari || true').toString().trim();
    if (!isRunning) return null;
    const script = `tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      set tTitle to name of t
      set tUrl to URL of t
      if tUrl contains "youtube.com/watch" or tTitle contains "- YouTube" or tUrl contains "music.youtube.com" then
        return tTitle & "|||" & tUrl
      end if
    end repeat
  end repeat
end tell`;
    const res = execFileSync('osascript', ['-e', script], { timeout: 2500 }).toString().trim();
    if (!res || res === 'missing value' || res.includes('error')) return null;
    const [rawTitle] = res.split('|||');
    return formatYouTubeTitle(rawTitle, 'Safari');
  } catch {
    return null;
  }
}

function getSpotifyMedia() {
  try {
    const isRunning = execSync('pgrep -x Spotify || true').toString().trim();
    if (!isRunning) return null;
    const script = `tell application "Spotify"
if player state is playing then
  return name of current track & "|||" & artist of current track & "|||" & album of current track
else
  return "PAUSED"
end if
end tell`;
    const res = execFileSync('osascript', ['-e', script], { timeout: 2500 }).toString().trim();
    if (!res || res === 'PAUSED' || res.includes('error')) return null;
    const [title, artist, album] = res.split('|||');
    return {
      title: title || 'Unknown Title',
      artist: artist || 'Unknown Artist',
      album: album || '',
      isPlaying: true,
      source: 'spotify',
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
      source: 'applemusic',
    };
  } catch {
    return null;
  }
}

function getNowPlayingMedia() {
  return (
    getAppleMusic() ||
    getSpotifyMedia() ||
    getChromiumMedia('Microsoft Edge', 'Edge') ||
    getChromiumMedia('Google Chrome', 'Chrome') ||
    getChromiumMedia('Brave Browser', 'Brave') ||
    getChromiumMedia('Arc', 'Arc') ||
    getSafariMedia() ||
    null
  );
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
  media: getNowPlayingMedia(),
};

process.stdout.write(JSON.stringify(payload));

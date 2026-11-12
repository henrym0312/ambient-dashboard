export interface SamsungTvState {
  id: string;
  name: string;
  isOnline: boolean;
  power: 'on' | 'off';
  inputSource: string;
  volume: number;
  isMuted: boolean;
  pictureMode?: string;
  soundMode?: string;
  playbackStatus?: string | null;
  updatedAt: string;
}

const DEFAULT_TV_ID = '4c19dcda-2f0a-d588-30d8-68cc28bba7d8';
const DEFAULT_PAT = '9ef9ddb0-f766-47a4-9491-9619329ce037';

export async function getSamsungTvState(targetDeviceId?: string): Promise<SamsungTvState | null> {
  const pat = process.env.SMARTTHINGS_PAT || DEFAULT_PAT;
  const deviceId = targetDeviceId || process.env.SMARTTHINGS_TV_DEVICE_ID || DEFAULT_TV_ID;
  const tvName = process.env.SMARTTHINGS_TV_NAME || 'Samsung TV';

  if (!pat) {
    return null;
  }

  try {
    const res = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}/status`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/json',
      },
      // Cache for 10 seconds to stay fast and avoid rate limits
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      console.error(`SmartThings status error: ${res.status} ${res.statusText}`);
      return null;
    }

    const st = await res.json();
    const main = st.components?.main || {};

    const power = (main.switch?.switch?.value as 'on' | 'off') || 'off';
    const rawInput =
      main['samsungvd.mediaInputSource']?.inputSource?.value ||
      main.mediaInputSource?.inputSource?.value ||
      'HDMI1';
    
    // Map raw input ID to human-friendly name
    let inputSource = rawInput;
    if (rawInput === 'HDMI1' || rawInput === 'HDMI 1') inputSource = 'HDMI 1';
    else if (rawInput === 'dtv' || rawInput === 'digitalTv') inputSource = 'Live TV';

    const volume = typeof main.audioVolume?.volume?.value === 'number' ? main.audioVolume.volume.value : 0;
    const isMuted = main.audioMute?.mute?.value === 'muted';
    const pictureMode = main['custom.picturemode']?.pictureMode?.value || 'Standard';
    const soundMode = main['custom.soundmode']?.soundMode?.value || 'Standard';
    const playbackStatus = main.mediaPlayback?.playbackStatus?.value || null;

    return {
      id: deviceId,
      name: tvName,
      isOnline: true,
      power,
      inputSource,
      volume,
      isMuted,
      pictureMode,
      soundMode,
      playbackStatus,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get Samsung TV status:', error);
    return null;
  }
}

export async function sendSamsungTvCommand(
  action: {
    capability: string;
    command: string;
    args?: unknown[];
    component?: string;
  },
  targetDeviceId?: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const pat = process.env.SMARTTHINGS_PAT || DEFAULT_PAT;
  const deviceId = targetDeviceId || process.env.SMARTTHINGS_TV_DEVICE_ID || DEFAULT_TV_ID;

  if (!pat) {
    return { success: false, error: 'Missing SMARTTHINGS_PAT' };
  }

  try {
    const payload = {
      commands: [
        {
          component: action.component || 'main',
          capability: action.capability,
          command: action.command,
          arguments: action.args ?? [],
        },
      ],
    };

    const res = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}/commands`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `SmartThings command failed: ${res.status} ${errText}` };
    }

    const data = await res.json();
    return { success: true, result: data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown command error',
    };
  }
}

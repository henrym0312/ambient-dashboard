import { NextResponse } from 'next/server';
import { getSamsungTvState, sendSamsungTvCommand } from '@/lib/smartthings';

export const maxDuration = 30;

export async function GET() {
  try {
    const tvState = await getSamsungTvState();
    return NextResponse.json(tvState || { power: 'off', isOnline: false });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, value, deviceId } = body;

    let result;

    switch (action) {
      case 'toggle': {
        const current = await getSamsungTvState(deviceId);
        const nextPower = current?.power === 'on' ? 'off' : 'on';
        result = await sendSamsungTvCommand(
          { capability: 'switch', command: nextPower },
          deviceId
        );
        break;
      }
      case 'power': {
        const cmd = value === 'on' ? 'on' : 'off';
        result = await sendSamsungTvCommand(
          { capability: 'switch', command: cmd },
          deviceId
        );
        break;
      }
      case 'volume': {
        const vol = Math.max(0, Math.min(100, Number(value) || 0));
        result = await sendSamsungTvCommand(
          { capability: 'audioVolume', command: 'setVolume', args: [vol] },
          deviceId
        );
        break;
      }
      case 'volumeUp': {
        result = await sendSamsungTvCommand(
          { capability: 'audioVolume', command: 'volumeUp' },
          deviceId
        );
        break;
      }
      case 'volumeDown': {
        result = await sendSamsungTvCommand(
          { capability: 'audioVolume', command: 'volumeDown' },
          deviceId
        );
        break;
      }
      case 'mute': {
        const cmd = value === true ? 'mute' : 'unmute';
        result = await sendSamsungTvCommand(
          { capability: 'audioMute', command: cmd },
          deviceId
        );
        break;
      }
      case 'input': {
        result = await sendSamsungTvCommand(
          { capability: 'mediaInputSource', command: 'setInputSource', args: [String(value)] },
          deviceId
        );
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Return the updated state
    const updated = await getSamsungTvState(deviceId);
    return NextResponse.json({ success: true, tv: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Command execution failed' },
      { status: 500 }
    );
  }
}

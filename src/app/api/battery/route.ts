import { NextResponse, connection } from 'next/server';
import { getRedis, isAuthorizedCron } from '@/lib/redis';

export interface DeviceBatteryItem {
  percent?: number | null;
  charging?: boolean;
  powerSource?: string;
  name?: string;
  updatedAt: string;
}

export interface AirPodsBatteryItem {
  left?: number | null;
  right?: number | null;
  case?: number | null;
  name?: string;
  updatedAt: string;
}

export interface MediaNowPlaying {
  title?: string;
  artist?: string;
  album?: string;
  isPlaying?: boolean;
  updatedAt?: string;
}

export interface BatteryFleetData {
  macbook?: DeviceBatteryItem | null;
  iphone?: DeviceBatteryItem | null;
  keyboard?: DeviceBatteryItem | null;
  mouse?: DeviceBatteryItem | null;
  airpods?: AirPodsBatteryItem | null;
  media?: MediaNowPlaying | null;
  updatedAt?: string;
}

const REDIS_KEY = 'dashboard_battery_fleet';

export async function GET() {
  await connection();
  try {
    const redis = await getRedis();
    const data = await redis.get(REDIS_KEY);
    if (!data) {
      return NextResponse.json({
        macbook: null,
        iphone: null,
        keyboard: null,
        mouse: null,
        airpods: null,
        updatedAt: null,
      });
    }
    const parsed = JSON.parse(data) as BatteryFleetData;
    return NextResponse.json(parsed);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch battery fleet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePercent(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    // If iOS Shortcut sent ratio 0.84 instead of 84%, scale by 100
    return val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val);
  }
  if (typeof val === 'string') {
    const cleaned = val.replace('%', '').trim();
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return num <= 1 && num > 0 ? Math.round(num * 100) : Math.round(num);
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const url = new URL(req.url);
    const secretQuery = url.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET || 'mySecretSyncKey123';

    const isAuthorized =
      isAuthorizedCron(authHeader) ||
      authHeader === `Bearer ${expectedSecret}` ||
      secretQuery === expectedSecret;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const redis = await getRedis();

    let currentFleet: BatteryFleetData = {
      macbook: null,
      iphone: null,
      keyboard: null,
      mouse: null,
      airpods: null,
    };

    try {
      const existing = await redis.get(REDIS_KEY);
      if (existing) {
        currentFleet = JSON.parse(existing) as BatteryFleetData;
      }
    } catch {
      // ignore
    }

    // Check if payload is single device (e.g. from iPhone Shortcut)
    if (typeof body.device === 'string') {
      const dev = body.device.toLowerCase();
      const rawPercent = body.percent ?? body.battery ?? body.level ?? body.batteryLevel ?? body.value;
      const percent = parsePercent(rawPercent);
      const charging = typeof body.charging === 'boolean' ? body.charging : undefined;
      const name = typeof body.name === 'string' ? body.name : undefined;
      const powerSource = typeof body.powerSource === 'string' ? body.powerSource : undefined;

      if (dev === 'iphone' || dev === 'phone' || dev === 'ios') {
        currentFleet.iphone = {
          percent,
          charging,
          name: name || 'iPhone',
          updatedAt: nowIso,
        };
      } else if (dev === 'macbook' || dev === 'mac') {
        currentFleet.macbook = {
          percent,
          charging,
          powerSource,
          name: name || 'MacBook Air',
          updatedAt: nowIso,
        };
      } else if (dev === 'keyboard') {
        currentFleet.keyboard = {
          percent,
          name: name || 'Logitech Keyboard',
          updatedAt: nowIso,
        };
      } else if (dev === 'mouse') {
        currentFleet.mouse = {
          percent,
          name: name || 'Logi LIFT Mouse',
          updatedAt: nowIso,
        };
      }
    } else {
      // Multi-device update from Mac sync script
      if (body.macbook && typeof body.macbook === 'object') {
        const mb = body.macbook as Record<string, unknown>;
        currentFleet.macbook = {
          percent: parsePercent(mb.percent ?? mb.battery),
          charging: typeof mb.charging === 'boolean' ? mb.charging : undefined,
          powerSource: typeof mb.powerSource === 'string' ? mb.powerSource : undefined,
          name: (mb.name as string) || 'MacBook Air',
          updatedAt: nowIso,
        };
      }
      if (body.iphone && typeof body.iphone === 'object') {
        const ip = body.iphone as Record<string, unknown>;
        currentFleet.iphone = {
          percent: parsePercent(ip.percent ?? ip.battery),
          charging: typeof ip.charging === 'boolean' ? ip.charging : undefined,
          name: (ip.name as string) || 'iPhone',
          updatedAt: nowIso,
        };
      }
      if (body.keyboard && typeof body.keyboard === 'object') {
        const kb = body.keyboard as Record<string, unknown>;
        currentFleet.keyboard = {
          percent: parsePercent(kb.percent ?? kb.battery),
          name: (kb.name as string) || 'Logitech Keyboard',
          updatedAt: nowIso,
        };
      }
      if (body.mouse && typeof body.mouse === 'object') {
        const ms = body.mouse as Record<string, unknown>;
        currentFleet.mouse = {
          percent: parsePercent(ms.percent ?? ms.battery),
          name: (ms.name as string) || 'Logi LIFT Mouse',
          updatedAt: nowIso,
        };
      }
      if (body.airpods && typeof body.airpods === 'object') {
        const ap = body.airpods as Record<string, unknown>;
        currentFleet.airpods = {
          left: parsePercent(ap.left),
          right: parsePercent(ap.right),
          case: parsePercent(ap.case),
          name: (ap.name as string) || 'AirPods Pro',
          updatedAt: nowIso,
        };
      }
      if (body.media !== undefined) {
        if (body.media && typeof body.media === 'object') {
          const m = body.media as Record<string, unknown>;
          currentFleet.media = {
            title: typeof m.title === 'string' ? m.title : undefined,
            artist: typeof m.artist === 'string' ? m.artist : undefined,
            album: typeof m.album === 'string' ? m.album : undefined,
            isPlaying: typeof m.isPlaying === 'boolean' ? m.isPlaying : false,
            updatedAt: nowIso,
          };
        } else {
          currentFleet.media = null;
        }
      }
    }

    currentFleet.updatedAt = nowIso;
    await redis.set(REDIS_KEY, JSON.stringify(currentFleet));

    return NextResponse.json({ success: true, fleet: currentFleet });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update battery fleet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

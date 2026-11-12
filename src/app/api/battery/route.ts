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

export interface BatteryFleetData {
  macbook?: DeviceBatteryItem | null;
  iphone?: DeviceBatteryItem | null;
  keyboard?: DeviceBatteryItem | null;
  mouse?: DeviceBatteryItem | null;
  airpods?: AirPodsBatteryItem | null;
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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    // Allow either Bearer token check or secret query param for simpler iOS Shortcut automation
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

    // Fetch existing fleet to merge incrementally
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

    // Check if payload is single device (e.g. from iPhone Shortcut: { device: 'iphone', percent: 84, charging: true })
    if (typeof body.device === 'string') {
      const dev = body.device.toLowerCase();
      const percent = typeof body.percent === 'number' ? body.percent : typeof body.battery === 'number' ? body.battery : null;
      const charging = typeof body.charging === 'boolean' ? body.charging : undefined;
      const name = typeof body.name === 'string' ? body.name : undefined;
      const powerSource = typeof body.powerSource === 'string' ? body.powerSource : undefined;

      if (dev === 'iphone') {
        currentFleet.iphone = {
          percent,
          charging,
          name: name || 'iPhone',
          updatedAt: nowIso,
        };
      } else if (dev === 'macbook') {
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
        currentFleet.macbook = {
          ...(body.macbook as DeviceBatteryItem),
          updatedAt: nowIso,
        };
      }
      if (body.iphone && typeof body.iphone === 'object') {
        currentFleet.iphone = {
          ...(body.iphone as DeviceBatteryItem),
          updatedAt: nowIso,
        };
      }
      if (body.keyboard && typeof body.keyboard === 'object') {
        currentFleet.keyboard = {
          ...(body.keyboard as DeviceBatteryItem),
          updatedAt: nowIso,
        };
      }
      if (body.mouse && typeof body.mouse === 'object') {
        currentFleet.mouse = {
          ...(body.mouse as DeviceBatteryItem),
          updatedAt: nowIso,
        };
      }
      if (body.airpods && typeof body.airpods === 'object') {
        currentFleet.airpods = {
          ...(body.airpods as AirPodsBatteryItem),
          updatedAt: nowIso,
        };
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

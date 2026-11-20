import { NextRequest } from 'next/server';
import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is not set');
  }
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error:', err));
  }
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const r = await getRedis();
  const val = await r.get(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return val as unknown as T;
  }
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const r = await getRedis();
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) {
    await r.set(key, payload, { EX: ttlSeconds });
  } else {
    await r.set(key, payload);
  }
}

export function isAuthorised(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.API_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader) return false;
  if (secret && authHeader === `Bearer ${secret}`) return true;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

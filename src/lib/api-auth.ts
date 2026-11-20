import { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export function isAuthorised(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.API_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader) return false;
  if (secret && authHeader === `Bearer ${secret}`) return true;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

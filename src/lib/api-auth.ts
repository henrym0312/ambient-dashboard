import { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();

export function isAuthorised(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.API_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader) return false;
  if (secret && authHeader === `Bearer ${secret}`) return true;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

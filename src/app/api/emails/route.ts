import { NextResponse } from 'next/server';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic'; // <--- THIS FIXES THE VERCEL CRASH

export async function GET(req: Request) {
  try {
    const redis = await createClient({ url: process.env.REDIS_URL }).connect();
    const data = await redis.get('apple_emails');
    await redis.disconnect();
    return NextResponse.json(data ? JSON.parse(data) : { gmail: { unread: 0, total: 0 }, uni: { unread: 0, total: 0 } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const redis = await createClient({ url: process.env.REDIS_URL }).connect();
    await redis.set('apple_emails', JSON.stringify(body));
    await redis.disconnect();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from 'redis';

// GET: Fetches reminders for the TV dashboard to display
export async function GET() {
  try {
    const redis = await createClient({ url: process.env.REDIS_URL }).connect();
    const data = await redis.get('apple_reminders');
    await redis.disconnect();
    return NextResponse.json(data ? JSON.parse(data) : []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: Receives tasks pushed from your MacBook Air background job
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const redis = await createClient({ url: process.env.REDIS_URL }).connect();
    await redis.set('apple_reminders', JSON.stringify(body));
    await redis.disconnect();

    return NextResponse.json({ success: true, count: body.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

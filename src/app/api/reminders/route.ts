import { NextResponse, connection } from 'next/server';
import { getRedis, isAuthorizedCron } from '@/lib/redis';

// GET: Fetches reminders for the TV dashboard to display
export async function GET() {
  await connection();
  try {
    const redis = await getRedis();
    const data = await redis.get('apple_reminders');
    return NextResponse.json(data ? JSON.parse(data) : []);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch reminders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Receives tasks pushed from your MacBook Air background job
export async function POST(req: Request) {
  try {
    if (!isAuthorizedCron(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const redis = await getRedis();
    await redis.set('apple_reminders', JSON.stringify(body));

    return NextResponse.json({
      success: true,
      count: Array.isArray(body) ? body.length : 0,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to store reminders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

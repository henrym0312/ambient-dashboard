import { NextResponse, connection } from 'next/server';
import { getRedis, isAuthorizedCron } from '@/lib/redis';

export async function GET() {
  await connection();
  try {
    const redis = await getRedis();
    const data = await redis.get('apple_emails');
    return NextResponse.json(
      data ? JSON.parse(data) : { gmail: { unread: 0, total: 0 }, uni: { unread: 0, total: 0 } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorizedCron(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const redis = await getRedis();
    await redis.set('apple_emails', JSON.stringify(body));
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to store emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

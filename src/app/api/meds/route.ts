import { NextResponse, connection } from 'next/server';
import { getRedis, isAuthorizedCron } from '@/lib/redis';
import { MedLogPayload } from '@/lib/meds';

export async function GET() {
  await connection();
  try {
    const redis = await getRedis();
    const data = await redis.get('adhd_med_log');
    if (!data) {
      return NextResponse.json({
        date: new Date().toISOString().split('T')[0],
        taken: {},
        updatedAt: null,
      });
    }

    const parsed = JSON.parse(data) as MedLogPayload;
    return NextResponse.json(parsed);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch medication log';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorizedCron(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as MedLogPayload;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const sanitized: MedLogPayload = {
      date: typeof body.date === 'string' ? body.date : nowIso.split('T')[0],
      taken: body.taken && typeof body.taken === 'object' ? body.taken : {},
      updatedAt: nowIso,
    };

    const redis = await getRedis();
    await Promise.all([
      redis.set('adhd_med_log', JSON.stringify(sanitized)),
      redis.set(
        'adhd_med_log_meta',
        JSON.stringify({
          updatedAt: nowIso,
          dosesCount: Object.values(sanitized.taken || {}).reduce(
            (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
            0
          ),
        })
      ),
    ]);

    return NextResponse.json({
      success: true,
      updatedAt: nowIso,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to save medication log';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

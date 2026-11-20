import { NextRequest, NextResponse } from 'next/server';
import { isAuthorised, kvGet, kvSet } from '@/lib/api-auth';

async function getValidOuraToken(): Promise<string | null> {
  const cachedAccess = await kvGet<string>('oura:access_token');
  if (cachedAccess) return cachedAccess;

  const refreshToken = (await kvGet<string>('oura:refresh_token')) || process.env.OURA_REFRESH_TOKEN;
  if (!refreshToken) return null;

  const res = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.OURA_CLIENT_ID || '',
      client_secret: process.env.OURA_CLIENT_SECRET || '',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();

  if (data.access_token) {
    const ttl = Math.max(300, (data.expires_in || 3600) - 300);
    await kvSet('oura:access_token', data.access_token, ttl);
  }
  if (data.refresh_token) {
    await kvSet('oura:refresh_token', data.refresh_token);
  }

  return data.access_token || null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const token = await getValidOuraToken();
    if (!token) {
      return NextResponse.json({ error: 'Oura authentication failed' }, { status: 500 });
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yestDate = new Date(now);
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split('T')[0];
    const headers = { Authorization: `Bearer ${token}` };

    const [rdyRes, slpRes, prdRes] = await Promise.all([
      fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${todayStr}&end_date=${todayStr}`, { headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${todayStr}&end_date=${todayStr}`, { headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${yestStr}&end_date=${todayStr}`, { headers }).then((r) => r.json()).catch(() => ({})),
    ]);

    const readiness = rdyRes.data?.length ? rdyRes.data[rdyRes.data.length - 1].score ?? '--' : '--';
    const sleepScore = slpRes.data?.length ? slpRes.data[slpRes.data.length - 1].score ?? '--' : '--';

    let sleepDur = '--';
    if (prdRes.data?.length) {
      const mainSleep =
        prdRes.data.filter((s: any) => s.type === 'long_sleep').pop() ||
        prdRes.data[prdRes.data.length - 1];
      if (mainSleep?.total_sleep_duration) {
        const hrs = Math.floor(mainSleep.total_sleep_duration / 3600);
        const mins = Math.round((mainSleep.total_sleep_duration % 3600) / 60);
        sleepDur = `${hrs}h ${mins}m`;
      }
    }

    return NextResponse.json(
      { readiness, sleepScore, sleepDur, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=60' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Oura query failed', detail: err?.message }, { status: 500 });
  }
}

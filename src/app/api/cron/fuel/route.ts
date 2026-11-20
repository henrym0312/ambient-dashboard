export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { isAuthorised, redis } from '@/lib/api-auth';

const TOKEN_URL = 'https://www.fuel-finder.service.gov.uk/api/v1/oauth/generate_access_token';
const INFO_URL = 'https://www.fuel-finder.service.gov.uk/api/v1/pfs';
const FUEL_URL = 'https://www.fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices';
const FUEL_TYPE = 'E10';

async function getAuthToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.FUEL_CLIENT_ID,
      client_secret: process.env.FUEL_CLIENT_SECRET,
    }),
  });
  const json = await res.json();
  return json.data ? json.data.access_token : json.access_token;
}

async function fetchPaginated(baseUrl: string, token: string): Promise<any[]> {
  const allData: any[] = [];
  let batch = 1;
  let keepFetching = true;

  while (keepFetching && batch <= 30) {
    const promises = [0, 1, 2].map((i) =>
      fetch(`${baseUrl}?batch-number=${batch + i}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    );

    const results = await Promise.all(promises);
    for (const res of results) {
      if (!res) { keepFetching = false; continue; }
      let items = res.data || res.stations || res.prices || res;
      if (!Array.isArray(items) && typeof items === 'object' && items !== null) {
        items = Object.values(items);
      }
      if (Array.isArray(items) && items.length > 0) {
        allData.push(...items);
        if (items.length < 50) keepFetching = false;
      } else {
        keepFetching = false;
      }
    }
    batch += 3;
  }
  return allData;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const token = await getAuthToken();
    const [stations, prices] = await Promise.all([
      fetchPaginated(INFO_URL, token),
      fetchPaginated(FUEL_URL, token),
    ]);

    const stationMap = new Map<string, any>();
    for (const s of stations) {
      const id = s.node_id || s.site_id || s.id;
      const lat = s.latitude || s.location?.latitude;
      const lon = s.longitude || s.location?.longitude;
      if (!id || !lat || !lon) continue;

      const locObj = s.location || {};
      const addrParts = [
        s.address_line_1 || locObj.address_line_1 || s.address || locObj.address || s.street,
        s.town || locObj.town || s.city || locObj.city,
        s.postcode || locObj.postcode,
      ].filter(Boolean);

      stationMap.set(id, {
        name: s.trading_name || s.brand_name || s.brand || 'Independent Station',
        address: addrParts.join(', ') || 'Address unavailable',
        lat: Number(lat),
        lon: Number(lon),
      });
    }

    const merged: any[] = [];
    for (const f of prices) {
      const id = f.node_id || f.site_id || f.id;
      const node = stationMap.get(id);
      if (!node) continue;

      let price: number | null = null;
      if (Array.isArray(f.fuel_prices)) {
        const pObj = f.fuel_prices.find(
          (p: any) => p.fuel_type === FUEL_TYPE || p.fuel_type === 'unleaded' || p.fuel_type === 'Unleaded'
        );
        if (pObj) price = parseFloat(pObj.price);
      } else if (f.prices && f.prices[FUEL_TYPE]) {
        price = parseFloat(f.prices[FUEL_TYPE]);
      }

      if (price !== null && !isNaN(price)) merged.push({ ...node, price });
    }

    await redis.set('fuel:dataset', { updatedAt: new Date().toISOString(), stations: merged });
    return NextResponse.json({ status: 'ok', count: merged.length });
  } catch (err: any) {
    return NextResponse.json({ error: 'Fuel sync failed', detail: err?.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorised, redis } from '@/lib/api-auth';

const MPG = 35;
const TANK_CAPACITY_LITRES = 40;
const LITRES_PER_GALLON = 4.54609;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '54.7753');
  const lon = parseFloat(req.nextUrl.searchParams.get('lon') || '-1.5849');
  const radius = parseFloat(req.nextUrl.searchParams.get('radius') || '5.5');

  const cached = await redis.get<{ updatedAt: string; stations: any[] }>('fuel:dataset');
  if (!cached || !Array.isArray(cached.stations)) {
    return NextResponse.json({ error: 'Fuel cache empty; trigger /api/cron/fuel first' }, { status: 503 });
  }

  const results = cached.stations
    .map((s) => {
      const distance = calculateDistance(lat, lon, s.lat, s.lon);
      if (distance > radius) return null;

      const pricePoundPerLitre = s.price / 100;
      const tripCost = ((distance * 2) / MPG) * LITRES_PER_GALLON * pricePoundPerLitre;
      const metrics = [10, 15, 20].map((amount) => ({
        amount,
        miles: ((amount / pricePoundPerLitre) * (MPG / LITRES_PER_GALLON)).toFixed(1),
      }));

      return {
        name: s.name,
        address: s.address,
        price: s.price,
        distance: Number(distance.toFixed(2)),
        tripCost: tripCost.toFixed(2),
        metrics,
        fullTankCost: (TANK_CAPACITY_LITRES * pricePoundPerLitre).toFixed(2),
        fullTankMiles: (TANK_CAPACITY_LITRES * (MPG / LITRES_PER_GALLON)).toFixed(1),
        wazeUrl: `https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes`,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.price - b.price || a.distance - b.distance);

  const updatedStr = new Date(cached.updatedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });

  return NextResponse.json({ results, updatedStr });
}

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorised } from '@/lib/api-auth';

const PURCHASE_PRICE = 385.00;
const PURE_GOLD_WEIGHT_G = 3.66;
const GRAMS_PER_TROY_OUNCE = 31.1034768;

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/PAXG-GBP/spot', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);

    const json = await res.json();
    const spotGbpPerOz = parseFloat(json.data.amount);
    const goldPerGram = spotGbpPerOz / GRAMS_PER_TROY_OUNCE;

    const currentValue = goldPerGram * PURE_GOLD_WEIGHT_G;
    const profitLossGbp = currentValue - PURCHASE_PRICE;
    const profitLossPct = (profitLossGbp / PURCHASE_PRICE) * 100;

    return NextResponse.json(
      {
        goldPerGram: Number(goldPerGram.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        profitLossGbp: Number(profitLossGbp.toFixed(2)),
        profitLossPct: Number(profitLossPct.toFixed(2)),
        isProfit: profitLossGbp >= 0,
        updatedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=60' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch gold spot price', detail: err?.message }, { status: 502 });
  }
}

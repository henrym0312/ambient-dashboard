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
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', { cache: 'no-store' }),
      fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP', { cache: 'no-store' }),
    ]);

    if (!goldRes.ok || !fxRes.ok) throw new Error('Upstream API failure');

    const goldData = await goldRes.json();
    const fxData = await fxRes.json();

    const spotUsdPerOz = parseFloat(goldData.price);
    const usdToGbpRate = parseFloat(fxData.rates.GBP);
    const goldPerGram = (spotUsdPerOz * usdToGbpRate) / GRAMS_PER_TROY_OUNCE;

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
  } catch {
    return NextResponse.json({ error: 'Failed to fetch gold spot price' }, { status: 502 });
  }
}

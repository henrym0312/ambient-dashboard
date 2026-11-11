import { NextResponse, connection } from 'next/server';
import Parser from 'rss-parser';
import ical, { type CalendarComponent, type ParameterValue, type VEvent } from 'node-ical';
import { getRedis } from '@/lib/redis';

export const maxDuration = 30;

const TZ = 'Europe/London';

function toLocalIsoDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

function unwrapParam(val?: ParameterValue): string {
  if (!val) return '';
  return typeof val === 'string' ? val : val.val || '';
}

interface OuraHistoryDay {
  day: string;
  label: string;
  sleep: number;
  readiness: number;
  hours: number;
}

interface OuraMetrics {
  readiness: number | string;
  sleep: number | string;
  steps: number | string;
  stress: string;
  battery?: number | null;
  history: OuraHistoryDay[];
}

export interface GoldData {
  paxgUsdt: number;
  gbpUsdt: number;
  gramPriceGbp: number;
  currentValue: number;
  purchasePrice: number;
  profitGbp: number;
  profitPct: number;
  isProfit: boolean;
}

interface OuraBatteryItem {
  id?: string;
  battery_level?: number | null;
  timestamp?: string;
}

interface OuraTokenData {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

interface OuraDailyScoreItem {
  day: string;
  score?: number | null;
  steps?: number | null;
  stress_high?: number | null;
  contributors?: {
    total_sleep?: number;
  };
}

interface OuraSleepPeriodItem {
  day: string;
  total_sleep_duration?: number | null;
}

interface CalendarEventItem {
  summary: string;
  start: string;
  end: string;
  location?: string;
  calendar: 'Main' | 'Uni';
  isFullDay?: boolean;
}

interface WeatherSummary {
  temp: number | string;
  precipitation: number;
  aqi: number | string;
  weatherCode: number;
  isDay: number;
}

interface DashboardSnapshot {
  weather: WeatherSummary;
  oura: OuraMetrics;
  events: CalendarEventItem[];
  news: string[];
  gold: GoldData;
  updatedAt: string;
}

function findLatestValue<T, V>(items: T[], selector: (item: T) => V | null | undefined): V | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const val = selector(items[i]);
    if (val !== undefined && val !== null) {
      return val;
    }
  }
  return null;
}

async function fetchCalendarFeed(
  url: string | undefined,
  calendarName: 'Main' | 'Uni',
  now: Date,
  rangeEnd: Date
): Promise<CalendarEventItem[]> {
  if (!url) return [];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6500) });
    if (!res.ok) return [];
    const icsText = await res.text();
    const parsed = ical.sync.parseICS(icsText);
    const results: CalendarEventItem[] = [];

    Object.values(parsed).forEach((comp: CalendarComponent | undefined) => {
      if (!comp || comp.type !== 'VEVENT') return;
      const event = comp as VEvent;
      if (event.recurrenceid) return;

      try {
        const instances = ical.expandRecurringEvent(event, {
          from: now,
          to: rangeEnd,
          expandOngoing: true,
        });

        for (const inst of instances) {
          const endDate = inst.end ? new Date(inst.end) : new Date(inst.start);
          if (endDate < now) continue;
          const summary = unwrapParam(inst.summary) || 'Untitled Event';
          const location = unwrapParam(inst.event?.location);
          results.push({
            summary,
            start: new Date(inst.start).toISOString(),
            end: endDate.toISOString(),
            location: location || undefined,
            calendar: calendarName,
            isFullDay: inst.isFullDay,
          });
        }
      } catch {
        const startDate = event.start ? new Date(event.start) : null;
        const endDate = event.end ? new Date(event.end) : startDate;
        if (startDate && endDate && endDate >= now && startDate <= rangeEnd) {
          results.push({
            summary: unwrapParam(event.summary) || 'Untitled Event',
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            location: unwrapParam(event.location) || undefined,
            calendar: calendarName,
          });
        }
      }
    });

    return results;
  } catch (e) {
    console.error(`[Calendar Fetch Error - ${calendarName}]:`, e);
    return [];
  }
}

export async function GET() {
  await connection();

  const redis = await getRedis().catch((e) => {
    console.error('Redis connection failed:', e);
    return null;
  });

  let lastGood: Partial<DashboardSnapshot> = {};
  if (redis) {
    try {
      const cached = await redis.get('dashboard_last_good');
      if (cached) lastGood = JSON.parse(cached) as Partial<DashboardSnapshot>;
    } catch {
      // Ignore corrupt cache
    }
  }

  const lat = process.env.LATITUDE || '54.7761';
  const lon = process.env.LONGITUDE || '-1.5733';

  // 1. Weather + AQI Task
  const weatherTask = (async (): Promise<WeatherSummary> => {
    try {
      const [weatherRes, aqiRes] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,precipitation,is_day&timezone=auto`,
          { signal: AbortSignal.timeout(4500) }
        ),
        fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`,
          { signal: AbortSignal.timeout(4500) }
        ),
      ]);

      const weatherData = weatherRes.ok ? await weatherRes.json() : null;
      const aqiData = aqiRes.ok ? await aqiRes.json() : null;

      if (weatherData?.current) {
        return {
          temp: Math.round(weatherData.current.temperature_2m ?? 0),
          precipitation: weatherData.current.precipitation ?? 0,
          aqi: aqiData?.current?.european_aqi ?? lastGood.weather?.aqi ?? '--',
          weatherCode: weatherData.current.weather_code ?? 0,
          isDay: weatherData.current.is_day ?? 1,
        };
      }
    } catch (e) {
      console.error('Weather fetch failed:', e);
    }
    return (
      lastGood.weather ?? {
        temp: '--',
        precipitation: 0,
        aqi: '--',
        weatherCode: 0,
        isDay: 1,
      }
    );
  })();

  // 2. Oura Biometrics Task
  const ouraTask = (async (): Promise<OuraMetrics> => {
    const fallbackOura: OuraMetrics = lastGood.oura ?? {
      readiness: '--',
      sleep: '--',
      steps: '--',
      stress: '--',
      history: [],
    };

    if (!redis) return fallbackOura;

    let tokenData: OuraTokenData | null = null;
    try {
      const tokenString = await redis.get('oura_tokens');
      if (tokenString) tokenData = JSON.parse(tokenString) as OuraTokenData;
    } catch (e) {
      console.error('Oura token read failed:', e);
    }

    if (!tokenData?.refresh_token) return fallbackOura;

    try {
      if (Date.now() > (tokenData.expires_at ?? 0)) {
        const refreshRes = await fetch('https://api.ouraring.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AmbientDashboard/1.0',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.OURA_CLIENT_ID || '',
            client_secret: process.env.OURA_CLIENT_SECRET || '',
            refresh_token: tokenData.refresh_token,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (refreshRes.ok) {
          const newTokens = await refreshRes.json();
          if (newTokens.access_token) {
            tokenData = {
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token || tokenData.refresh_token,
              expires_at: Date.now() + (newTokens.expires_in || 86400) * 1000 - 300000,
            };
            await redis.set('oura_tokens', JSON.stringify(tokenData));
          }
        }
      }

      if (!tokenData.access_token) return fallbackOura;

      const now = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 8);
      const endDate = toLocalIsoDate(now);
      const startDate = toLocalIsoDate(past);
      const headers = {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'AmbientDashboard/1.0',
      };

      const [readinessRes, sleepRes, activityRes, stressRes, sleepPeriodsRes, batteryRes] = await Promise.all([
        fetch(
          `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`,
          { headers, signal: AbortSignal.timeout(5500) }
        ),
        fetch(
          `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`,
          { headers, signal: AbortSignal.timeout(5500) }
        ),
        fetch(
          `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`,
          { headers, signal: AbortSignal.timeout(5500) }
        ),
        fetch(
          `https://api.ouraring.com/v2/usercollection/daily_stress?start_date=${startDate}&end_date=${endDate}`,
          { headers, signal: AbortSignal.timeout(5500) }
        ),
        fetch(
          `https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`,
          { headers, signal: AbortSignal.timeout(5500) }
        ),
        fetch(
          `https://api.ouraring.com/v2/usercollection/ring_battery_level?start_datetime=${startDate}T00:00:00Z&end_datetime=${endDate}T23:59:59Z`,
          { headers, signal: AbortSignal.timeout(5500) }
        ).catch(() => null),
      ]);

      const readinessData: OuraDailyScoreItem[] = readinessRes.ok
        ? (await readinessRes.json()).data || []
        : [];
      const sleepData: OuraDailyScoreItem[] = sleepRes.ok
        ? (await sleepRes.json()).data || []
        : [];
      const activityData: OuraDailyScoreItem[] = activityRes.ok
        ? (await activityRes.json()).data || []
        : [];
      const stressData: OuraDailyScoreItem[] = stressRes.ok
        ? (await stressRes.json()).data || []
        : [];
      const sleepPeriodsData: OuraSleepPeriodItem[] = sleepPeriodsRes.ok
        ? (await sleepPeriodsRes.json()).data || []
        : [];

      let ringBattery: number | null = null;
      if (batteryRes && batteryRes.ok) {
        try {
          const batteryJson = await batteryRes.json();
          const batteryItems: OuraBatteryItem[] = batteryJson.data || [];
          ringBattery = findLatestValue(batteryItems, (d) => d.battery_level);
        } catch {
          // ignore error
        }
      }

      const readinessScore = findLatestValue(readinessData, (d) => d.score);
      const sleepScore = findLatestValue(sleepData, (d) => d.score);
      const stepsCount = findLatestValue(activityData, (d) => d.steps);
      const stressHigh = findLatestValue(stressData, (d) => d.stress_high);

      const dayMap: Record<string, OuraHistoryDay> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = toLocalIsoDate(d);
        const label = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: TZ }).slice(0, 2);
        dayMap[iso] = { day: iso, label, sleep: 0, readiness: 0, hours: 0 };
      }

      sleepData.forEach((item) => {
        if (dayMap[item.day]) {
          dayMap[item.day].sleep = item.score || 0;
          if (!dayMap[item.day].hours && item.contributors?.total_sleep) {
            dayMap[item.day].hours = Number(
              ((item.contributors.total_sleep / 100) * 8.5).toFixed(1)
            );
          }
        }
      });

      readinessData.forEach((item) => {
        if (dayMap[item.day]) {
          dayMap[item.day].readiness = item.score || 0;
        }
      });

      sleepPeriodsData.forEach((item) => {
        if (dayMap[item.day] && item.total_sleep_duration) {
          const hrs = Number((item.total_sleep_duration / 3600).toFixed(1));
          if (hrs > dayMap[item.day].hours) dayMap[item.day].hours = hrs;
        }
      });

      return {
        readiness: readinessScore ?? fallbackOura.readiness,
        sleep: sleepScore ?? fallbackOura.sleep,
        steps: stepsCount ?? fallbackOura.steps,
        stress:
          stressHigh !== null ? Math.round(stressHigh / 60).toString() : fallbackOura.stress,
        battery: ringBattery ?? fallbackOura.battery ?? null,
        history: Object.values(dayMap),
      };
    } catch (e) {
      console.error('Oura API error:', e);
      return fallbackOura;
    }
  })();

  // 3. Google Calendars Task (Parallel Main + Uni with RRULE & ongoing support)
  const calendarTask = (async (): Promise<CalendarEventItem[]> => {
    const now = new Date();
    const rangeEnd = new Date(now.getTime() + 21 * 86400000);
    const [mainEvents, uniEvents] = await Promise.all([
      fetchCalendarFeed(process.env.GOOGLE_CALENDAR_URL_MAIN, 'Main', now, rangeEnd),
      fetchCalendarFeed(process.env.GOOGLE_CALENDAR_URL_UNI, 'Uni', now, rangeEnd),
    ]);
    const combined = [...mainEvents, ...uniEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    if (combined.length > 0 || (!process.env.GOOGLE_CALENDAR_URL_MAIN && !process.env.GOOGLE_CALENDAR_URL_UNI)) {
      return combined.slice(0, 16);
    }
    return lastGood.events ?? [];
  })();

  // 4. BBC News RSS Task (Protected with timeout & fallback)
  const newsTask = (async (): Promise<string[]> => {
    try {
      const parser = new Parser({ timeout: 5000 });
      const feed = await parser.parseURL('https://feeds.bbci.co.uk/news/world/rss.xml');
      const headlines = feed.items
        .slice(0, 8)
        .map((item) => item.title?.trim() || '')
        .filter(Boolean);
      if (headlines.length > 0) return headlines;
    } catch (e) {
      console.error('BBC RSS fetch failed:', e);
    }
    return lastGood.news ?? [];
  })();

  // 5. Half Sovereign Live Gold Tracker (PAXGUSDT / GBPUSDT -> 3.66g pure 22k gold)
  const goldTask = (async (): Promise<GoldData> => {
    const fallbackGold: GoldData = lastGood.gold ?? {
      paxgUsdt: 2750,
      gbpUsdt: 1.30,
      gramPriceGbp: 68.1,
      currentValue: 352.85,
      purchasePrice: 385.0,
      profitGbp: -32.15,
      profitPct: -8.35,
      isProfit: false,
    };

    try {
      const [paxgRes, gbpRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', {
          signal: AbortSignal.timeout(4500),
        }),
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=GBPUSDT', {
          signal: AbortSignal.timeout(4500),
        }),
      ]);

      let paxgUsdt = 0;
      let gbpUsdt = 0;

      if (paxgRes.ok) {
        const paxgData = (await paxgRes.json()) as { price?: string };
        paxgUsdt = parseFloat(paxgData.price || '0');
      }

      if (gbpRes.ok) {
        const gbpData = (await gbpRes.json()) as { price?: string };
        gbpUsdt = parseFloat(gbpData.price || '0');
      }

      // If GBPUSDT is not available from Binance, fall back to open exchangerate or default
      if (!gbpUsdt || gbpUsdt <= 0) {
        try {
          const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', {
            signal: AbortSignal.timeout(3000),
          });
          if (fxRes.ok) {
            const fxData = await fxRes.json();
            const usdToGbp = fxData?.rates?.GBP;
            if (usdToGbp && usdToGbp > 0) {
              gbpUsdt = 1 / usdToGbp;
            }
          }
        } catch {
          // ignore error
        }
      }

      if (!gbpUsdt || gbpUsdt <= 0) {
        gbpUsdt = fallbackGold.gbpUsdt || 1.30;
      }

      if (paxgUsdt > 0 && gbpUsdt > 0) {
        // Price per troy ounce in GBP = paxgUsdt / gbpUsdt
        const ozPriceGbp = paxgUsdt / gbpUsdt;
        // Gram price in GBP (1 troy oz = 31.1034768 grams)
        const gramPriceGbp = Number((ozPriceGbp / 31.1034768).toFixed(2));
        // Half Sovereign contains 3.66g pure 22k gold (gross 3.99g * 22/24)
        const HALF_SOVEREIGN_FINE_GRAMS = 3.66;
        const currentValue = Number((gramPriceGbp * HALF_SOVEREIGN_FINE_GRAMS).toFixed(2));
        const purchasePrice = 385.0;
        const profitGbp = Number((currentValue - purchasePrice).toFixed(2));
        const profitPct = Number((((currentValue - purchasePrice) / purchasePrice) * 100).toFixed(2));
        const isProfit = profitGbp >= 0;

        return {
          paxgUsdt,
          gbpUsdt,
          gramPriceGbp,
          currentValue,
          purchasePrice,
          profitGbp,
          profitPct,
          isProfit,
        };
      }
    } catch (e) {
      console.error('Gold fetch failed:', e);
    }

    return fallbackGold;
  })();

  const [weather, oura, events, news, gold] = await Promise.all([
    weatherTask,
    ouraTask,
    calendarTask,
    newsTask,
    goldTask,
  ]);

  const payload: DashboardSnapshot = {
    weather,
    oura,
    events,
    news,
    gold,
    updatedAt: new Date().toISOString(),
  };

  if (redis) {
    redis.set('dashboard_last_good', JSON.stringify(payload)).catch(() => {});
  }

  return NextResponse.json(payload);
}

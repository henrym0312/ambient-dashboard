import { NextResponse, connection } from 'next/server';
import { GET as getDashboard } from '@/app/api/dashboard/route';
import { GET as getReminders } from '@/app/api/reminders/route';
import {
  RmWeather,
  RmGold,
  RmOura,
  RmCalendarEvent,
  RmReminderItem,
  RmDashboardPayload,
} from '@/lib/remarkable';

const PROD_BASE_URL =
  process.env.DASHBOARD_API_URL || 'https://ambient-dashboard-henry-seven.vercel.app';

export async function loadRemarkableData(): Promise<RmDashboardPayload> {
  let weather: RmWeather = { temp: '--', precipitation: 0, aqi: '--', weatherCode: 0, isDay: 1 };
  let oura: RmOura = {
    readiness: '--',
    sleep: '--',
    steps: '--',
    stress: '--',
    battery: null,
    history: [],
  };
  let events: RmCalendarEvent[] = [];
  let gold: RmGold = {
    paxgUsdt: 0,
    gbpUsdt: 1.3,
    gramPriceGbp: 0,
    currentValue: 0,
    purchasePrice: 385,
    profitGbp: 0,
    profitPct: 0,
    isProfit: false,
  };
  let reminders: RmReminderItem[] = [];
  let news: string[] = [];
  let updatedAt = new Date().toISOString();

  // If REDIS_URL is configured (e.g. on Vercel), execute route handlers directly in-process.
  // If running locally without REDIS_URL, pull the live production snapshot from Vercel so Oura & Reminders work seamlessly.
  if (process.env.REDIS_URL) {
    const [dashRes, remRes] = await Promise.allSettled([getDashboard(), getReminders()]);

    if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
      const dashJson = await dashRes.value.json();
      if (dashJson.weather) weather = dashJson.weather;
      if (dashJson.oura) oura = dashJson.oura;
      if (Array.isArray(dashJson.events)) events = dashJson.events;
      if (dashJson.gold) gold = dashJson.gold;
      if (Array.isArray(dashJson.news)) news = dashJson.news;
      if (dashJson.updatedAt) updatedAt = dashJson.updatedAt;
    }

    if (remRes.status === 'fulfilled' && remRes.value.ok) {
      const remJson = await remRes.value.json();
      if (Array.isArray(remJson)) {
        reminders = remJson;
      } else if (Array.isArray(remJson?.items)) {
        reminders = remJson.items;
      }
    }
  } else {
    const [dashRes, remRes] = await Promise.allSettled([
      fetch(`${PROD_BASE_URL}/api/dashboard`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`${PROD_BASE_URL}/api/reminders`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
      const dashJson = await dashRes.value.json();
      if (dashJson.weather) weather = dashJson.weather;
      if (dashJson.oura) oura = dashJson.oura;
      if (Array.isArray(dashJson.events)) events = dashJson.events;
      if (dashJson.gold) gold = dashJson.gold;
      if (Array.isArray(dashJson.news)) news = dashJson.news;
      if (dashJson.updatedAt) updatedAt = dashJson.updatedAt;
    }

    if (remRes.status === 'fulfilled' && remRes.value.ok) {
      const remJson = await remRes.value.json();
      if (Array.isArray(remJson)) {
        reminders = remJson;
      } else if (Array.isArray(remJson?.items)) {
        reminders = remJson.items;
      }
    }
  }

  return {
    weather,
    oura,
    events,
    gold,
    reminders,
    news,
    updatedAt,
  };
}

export async function GET() {
  await connection();
  const payload = await loadRemarkableData();
  return NextResponse.json(payload);
}

import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import ical from 'node-ical';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const lat = process.env.LATITUDE || '54.7761';
    const lon = process.env.LONGITUDE || '-1.5733';

    // 1. Fetch Weather & Air Quality
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,precipitation&timezone=auto`, { next: { revalidate: 900 } }),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`, { next: { revalidate: 1800 } })
    ]);
    
    const weatherData = await weatherRes.json();
    const aqiData = await aqiRes.json();

    // 2. Fetch Oura Metrics + 7-Day History
    let oura: any = { readiness: '--', sleep: '--', steps: '--', stress: '--', history: [] };
    const tokenPath = path.join(process.cwd(), '.next', 'oura-tokens.json');
    
    if (fs.existsSync(tokenPath)) {
      try {
        let tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

        if (Date.now() > tokenData.expires_at) {
          const refreshRes = await fetch('https://api.ouraring.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AmbientDashboard/1.0' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: process.env.OURA_CLIENT_ID || '',
              client_secret: process.env.OURA_CLIENT_SECRET || '',
              refresh_token: tokenData.refresh_token
            })
          });
          const newTokens = await refreshRes.json();
          if (newTokens.access_token) {
            tokenData = {
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token,
              expires_at: Date.now() + ((newTokens.expires_in || 86400) * 1000) - 300000
            };
            fs.writeFileSync(tokenPath, JSON.stringify(tokenData));
          }
        }

        if (tokenData.access_token) {
          const now = new Date();
          const past = new Date();
          past.setDate(past.getDate() - 8);
          const endDate = now.toISOString().split('T')[0];
          const startDate = past.toISOString().split('T')[0];
          const headers = { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': 'AmbientDashboard/1.0' };
          
          const [readinessRes, sleepRes, activityRes, stressRes, sleepPeriodsRes] = await Promise.all([
            fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`, { headers }),
            fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`, { headers }),
            fetch(`https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`, { headers }),
            fetch(`https://api.ouraring.com/v2/usercollection/daily_stress?start_date=${startDate}&end_date=${endDate}`, { headers }),
            fetch(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`, { headers })
          ]);

          const readinessData = readinessRes.ok ? (await readinessRes.json()).data || [] : [];
          const sleepData = sleepRes.ok ? (await sleepRes.json()).data || [] : [];
          const activityData = activityRes.ok ? (await activityRes.json()).data || [] : [];
          const stressData = stressRes.ok ? (await stressRes.json()).data || [] : [];
          const sleepPeriodsData = sleepPeriodsRes.ok ? (await sleepPeriodsRes.json()).data || [] : [];

          oura.readiness = readinessData[readinessData.length - 1]?.score ?? '--';
          oura.sleep = sleepData[sleepData.length - 1]?.score ?? '--';
          oura.steps = activityData[activityData.length - 1]?.steps ?? '--';
          const stressHigh = stressData[stressData.length - 1]?.stress_high;
          if (stressHigh !== undefined && stressHigh !== null) {
            oura.stress = Math.round(stressHigh / 60).toString();
          }

          // Map 7-Day History for Graphs
          const dayMap: Record<string, any> = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2);
            dayMap[iso] = { day: iso, label, sleep: 0, readiness: 0, hours: 0 };
          }

          sleepData.forEach((item: any) => {
            if (dayMap[item.day]) {
              dayMap[item.day].sleep = item.score || 0;
              // Fallback estimate if raw sleep duration endpoint isn't populated for that day
              if (!dayMap[item.day].hours && item.contributors?.total_sleep) {
                dayMap[item.day].hours = Number(((item.contributors.total_sleep / 100) * 8.5).toFixed(1));
              }
            }
          });

          readinessData.forEach((item: any) => {
            if (dayMap[item.day]) dayMap[item.day].readiness = item.score || 0;
          });

          sleepPeriodsData.forEach((item: any) => {
            if (dayMap[item.day] && item.total_sleep_duration) {
              const hrs = Number((item.total_sleep_duration / 3600).toFixed(1));
              if (hrs > dayMap[item.day].hours) dayMap[item.day].hours = hrs;
            }
          });

          oura.history = Object.values(dayMap);
        }
      } catch (e) {
        console.error("Oura Error:", e);
      }
    }

    // 3. Fetch Google Calendars (Tagging Main vs Uni)
    let calendarEvents: any[] = [];
    try {
      const mainUrl = process.env.GOOGLE_CALENDAR_URL_MAIN;
      const uniUrl = process.env.GOOGLE_CALENDAR_URL_UNI;
      const now = new Date();
      const allEvents: any[] = [];

      if (mainUrl) {
        const mainData = await ical.async.fromURL(mainUrl);
        Object.values(mainData).forEach((e: any) => {
          if (e.type === 'VEVENT' && new Date(e.start) >= now) {
            allEvents.push({ summary: e.summary, start: e.start, calendar: 'Main' });
          }
        });
      }

      if (uniUrl) {
        const uniData = await ical.async.fromURL(uniUrl);
        Object.values(uniData).forEach((e: any) => {
          if (e.type === 'VEVENT' && new Date(e.start) >= now) {
            allEvents.push({ summary: e.summary, start: e.start, calendar: 'Uni' });
          }
        });
      }

      calendarEvents = allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0, 12);
    } catch (e) {}

    // 4. Fetch RSS News
    const parser = new Parser();
    const feed = await parser.parseURL('https://feeds.bbci.co.uk/news/world/rss.xml');
    const news = feed.items.slice(0, 6).map(item => item.title);

    return NextResponse.json({
      weather: {
        temp: Math.round(weatherData.current?.temperature_2m ?? 0),
        precipitation: weatherData.current?.precipitation ?? 0,
        aqi: aqiData.current?.european_aqi ?? '--',
      },
      oura,
      events: calendarEvents,
      news,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

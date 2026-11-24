'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  Battery,
  Calendar,
  CheckSquare,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Coins,
  Download,
  Maximize2,
  Minimize2,
  Moon,
  RefreshCw,
  Sun,
  TrendingDown,
  TrendingUp,
  Umbrella,
} from 'lucide-react';
import {
  RM_WIDTH,
  RM_HEIGHT,
  RM_TZ,
  RmWeather,
  RmGold,
  RmOura,
  RmCalendarEvent,
  RmReminderItem,
  getWeatherConditionLabel,
  getEventTypeTag,
  isAcademicEvent,
  getRelativeTime,
  getNextEventStatus,
  getReminderListLabel,
  selectTopReminders,
  buildSleepChartModel,
  groupCalendarEvents,
} from '@/lib/remarkable';

interface RemarkableState {
  weather: RmWeather;
  oura: RmOura;
  events: RmCalendarEvent[];
  gold: RmGold;
  reminders: RmReminderItem[];
  updatedAt?: string;
}

function getMonochromeWeatherIcon(code: number = 0, isDay: number = 1) {
  if (code >= 95) return CloudLightning;
  if (code >= 71 && code <= 86) return CloudSnow;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if (code >= 1 && code <= 48) return Cloud;
  return isDay === 0 ? Moon : Sun;
}

export default function RemarkableDashboardPage() {
  const [now, setNow] = useState<Date | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rawMode, setRawMode] = useState(false);

  const [data, setData] = useState<RemarkableState>({
    weather: { temp: '--', precipitation: 0, aqi: '--', weatherCode: 0, isDay: 1 },
    oura: { readiness: '--', sleep: '--', steps: '--', stress: '--', battery: null, history: [] },
    events: [],
    reminders: [],
    gold: {
      paxgUsdt: 0,
      gbpUsdt: 1.3,
      gramPriceGbp: 0,
      currentValue: 0,
      purchasePrice: 385,
      profitGbp: 0,
      profitPct: 0,
      isProfit: false,
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('raw') === '1') {
        setRawMode(true);
      }
    }
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(clock);
  }, []);

  const fetchAll = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/remarkable/data', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData((prev) => ({
          ...prev,
          ...(json.weather ? { weather: json.weather } : {}),
          ...(json.oura ? { oura: json.oura } : {}),
          ...(Array.isArray(json.events) ? { events: json.events } : {}),
          ...(json.gold ? { gold: json.gold } : {}),
          ...(Array.isArray(json.reminders) ? { reminders: json.reminders } : {}),
          ...(json.updatedAt ? { updatedAt: json.updatedAt } : {}),
        }));
        setLastSyncedAt(new Date());
      }
    } catch (e) {
      console.error('reMarkable dashboard fetch failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 30000);
    return () => clearInterval(poll);
  }, []);

  const timeString = now
    ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: RM_TZ })
    : '--:--';

  const dateString = now
    ? now
        .toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          timeZone: RM_TZ,
        })
        .toUpperCase()
    : 'LOADING...';

  const nextEvent = data.events.length > 0 ? data.events[0] : null;
  const nextEventStatus = useMemo(
    () =>
      now
        ? getNextEventStatus(now, nextEvent)
        : { isActive: false, progressPct: 0, isSoon: false },
    [now, nextEvent]
  );

  const sleepChart = useMemo(
    () => buildSleepChartModel(data.oura?.history || [], 620, 290),
    [data.oura?.history]
  );

  const scheduleGroups = useMemo(
    () =>
      now
        ? groupCalendarEvents(now, data.events || [], 5)
        : { groups: [], eventsLeftToday: 0 },
    [now, data.events]
  );

  const remindersModel = useMemo(
    () =>
      now
        ? selectTopReminders(now, data.reminders || [], 8)
        : { items: [], leftToday: 0 },
    [now, data.reminders]
  );

  const WeatherIcon = getMonochromeWeatherIcon(data.weather?.weatherCode, data.weather?.isDay);
  const weatherLabel = getWeatherConditionLabel(data.weather?.weatherCode, data.weather?.isDay);
  const stepsFormatted =
    typeof data.oura?.steps === 'number'
      ? data.oura.steps.toLocaleString('en-GB')
      : data.oura?.steps ?? '--';

  return (
    <div
      className={
        rawMode
          ? 'bg-white text-black m-0 p-0 overflow-hidden'
          : 'min-h-screen bg-[#18181b] text-black flex flex-col items-center py-6 px-4 select-none'
      }
    >
      {/* Desktop Preview Toolbar (Hidden in ?raw=1 mode) */}
      {!rawMode && (
        <div className="w-full max-w-[1872px] mb-4 px-5 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md bg-white text-black text-xs font-bold uppercase tracking-widest">
              reMarkable 2
            </span>
            <span className="text-sm font-medium text-zinc-300">
              1872 × 1404 E-Ink Landscape Canvas • 7 Widgets
            </span>
            {lastSyncedAt && (
              <span className="text-xs text-zinc-400 font-mono">
                Synced {lastSyncedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchAll}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <button
              type="button"
              onClick={() => setRawMode(true)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              1:1 Frame
            </button>
            <a
              href="/api/remarkable"
              download="suspended-landscape.png"
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Landscape PNG
            </a>
          </div>
        </div>
      )}

      {rawMode && (
        <button
          type="button"
          onClick={() => setRawMode(false)}
          title="Exit 1:1 Frame"
          className="fixed top-3 right-3 z-50 p-2 rounded-lg bg-black/10 hover:bg-black/20 text-black print:hidden cursor-pointer"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}

      {/* EXACT 1872x1404 REMARKABLE 2 LANDSCAPE E-INK DISPLAY CANVAS */}
      <div
        style={{ width: `${RM_WIDTH}px`, height: `${RM_HEIGHT}px` }}
        className={`bg-[#FAF9F5] text-[#111111] flex flex-col justify-between p-10 box-border font-sans ${
          rawMode ? '' : 'shadow-[0_25px_70px_rgba(0,0,0,0.65)] border-4 border-zinc-700'
        }`}
      >
        {/* TOP HEADER BAR: CLOCK + UP NEXT + WEATHER + GOLD PRICE */}
        <header className="grid grid-cols-12 gap-5 items-stretch shrink-0 h-[196px] border-b-4 border-[#111111] pb-6">
          {/* 1. CLOCK & DATE (3 COLS) */}
          <div className="col-span-3 flex flex-col justify-between pr-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 bg-[#111111] text-white text-[11px] font-extrabold uppercase tracking-[0.2em]">
                RM2 E-INK
              </span>
              <span className="text-sm font-extrabold tracking-[0.14em] text-[#333333] truncate">
                {dateString}
              </span>
            </div>
            <div className="text-[96px] font-extrabold tracking-tighter leading-none tabular-nums text-[#111111]">
              {timeString}
            </div>
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#555555]">
              Durham, UK • Live Snapshot
            </div>
          </div>

          {/* 2. WIDGET 1: UP NEXT (4 COLS) */}
          <div className="col-span-4 border-[3px] border-[#111111] bg-white p-4 flex flex-col justify-between relative">
            <div className="flex items-center justify-between border-b-2 border-[#111111]/15 pb-2">
              <span
                className={`px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-[0.16em] border border-[#111111] ${
                  nextEventStatus.isActive
                    ? 'bg-[#111111] text-white'
                    : 'bg-[#EBEAE4] text-[#111111]'
                }`}
              >
                {nextEventStatus.isActive ? '● NOW ACTIVE' : '01 / UP NEXT'}
              </span>
              <span className="text-base font-extrabold font-mono tabular-nums text-[#111111]">
                {nextEvent && now ? getRelativeTime(now, nextEvent.start, nextEvent.end) : 'RELAX'}
              </span>
            </div>

            <div className="my-1 min-w-0">
              <div className="text-2xl font-extrabold tracking-tight text-[#111111] truncate">
                {nextEvent ? nextEvent.summary : 'Clear Schedule'}
              </div>
              <div className="text-xs font-semibold text-[#444444] truncate mt-0.5">
                {nextEvent?.location ? nextEvent.location : 'No immediate calendar conflicts'}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#333333] pt-1.5 border-t border-[#111111]/15">
              <span>
                {nextEvent
                  ? `${new Date(nextEvent.start).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: RM_TZ,
                    })}${
                      nextEvent.end
                        ? ` – ${new Date(nextEvent.end).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: RM_TZ,
                          })}`
                        : ''
                    }`
                  : 'ALL CLEAR'}
              </span>
              <span className="px-1.5 py-0.5 border border-[#111111] uppercase">
                {nextEvent ? getEventTypeTag(nextEvent.summary) : 'STANDBY'}
              </span>
            </div>
          </div>

          {/* 3. WIDGET 2: WEATHER (2 COLS) */}
          <div className="col-span-2 border-[3px] border-[#111111] bg-white p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b-2 border-[#111111]/15 pb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#333333]">
                02 / WEATHER
              </span>
              <WeatherIcon className="w-5 h-5 stroke-[2.4] text-[#111111]" />
            </div>

            <div className="flex items-baseline justify-between my-1">
              <span className="text-5xl font-extrabold tracking-tight tabular-nums leading-none">
                {data.weather?.temp}°C
              </span>
              <span className="text-xs font-bold uppercase text-[#333333] truncate ml-1">
                {weatherLabel}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#333333] pt-1.5 border-t border-[#111111]/15 tabular-nums">
              <span className="flex items-center gap-1">
                <Umbrella className="w-3.5 h-3.5" />
                {data.weather?.precipitation ?? 0}mm
              </span>
              <span>AQI {data.weather?.aqi ?? '--'}</span>
            </div>
          </div>

          {/* 4. WIDGET 3: GOLD PRICE (3 COLS) */}
          <div className="col-span-3 border-[3px] border-[#111111] bg-white p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b-2 border-[#111111]/15 pb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#333333] flex items-center gap-1.5">
                <Coins className="w-4 h-4" />
                03 / ½ SOVEREIGN
              </span>
              <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[11px] font-mono font-bold">
                3.66g 22K
              </span>
            </div>

            <div className="flex items-baseline justify-between my-1 tabular-nums">
              <span className="text-4xl font-extrabold tracking-tight leading-none">
                {data.gold?.currentValue ? `£${data.gold.currentValue.toFixed(2)}` : '£--'}
              </span>
              {data.gold && data.gold.currentValue > 0 && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 border-2 border-[#111111] text-xs font-extrabold ${
                    data.gold.isProfit ? 'bg-[#111111] text-white' : 'bg-white text-[#111111]'
                  }`}
                >
                  {data.gold.isProfit ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {data.gold.isProfit ? '+' : '-'}£{Math.abs(data.gold.profitGbp).toFixed(2)} (
                  {data.gold.isProfit ? '+' : ''}
                  {data.gold.profitPct.toFixed(1)}%)
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#333333] pt-1.5 border-t border-[#111111]/15 tabular-nums">
              <span>Cost: £{data.gold?.purchasePrice?.toFixed(0) || '385'}</span>
              <span>
                Spot: {data.gold?.gramPriceGbp ? `£${data.gold.gramPriceGbp.toFixed(2)}/g` : '--'}
              </span>
            </div>
          </div>
        </header>

        {/* MAIN 2-COLUMN LANDSCAPE BODY */}
        <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 pt-6">
          {/* LEFT COLUMN (5 COLS): OURA BIOMETRICS + 7-DAY SLEEP TREND */}
          <div className="col-span-5 flex flex-col gap-6 min-h-0">
            {/* WIDGET 4: OURA BIOMETRICS */}
            <div className="border-[3px] border-[#111111] bg-white p-6 flex flex-col justify-between shrink-0">
              <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 stroke-[2.5]" />
                  <span className="text-sm font-extrabold uppercase tracking-[0.18em]">
                    04 / OURA BIOMETRICS
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border-2 border-[#111111] text-xs font-mono font-bold">
                  <Battery className="w-4 h-4" />
                  RING{' '}
                  {data.oura?.battery !== null && data.oura?.battery !== undefined
                    ? `${data.oura.battery}%`
                    : '--%'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 tabular-nums">
                <div className="border-2 border-[#111111] p-4 bg-[#FAF9F5] flex flex-col justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#444444]">
                    READINESS
                  </span>
                  <span className="text-5xl font-extrabold tracking-tight mt-1">
                    {data.oura?.readiness}
                  </span>
                </div>

                <div className="border-2 border-[#111111] p-4 bg-[#FAF9F5] flex flex-col justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#444444]">
                    SLEEP SCORE
                  </span>
                  <span className="text-5xl font-extrabold tracking-tight mt-1">
                    {data.oura?.sleep}
                  </span>
                </div>

                <div className="border-2 border-[#111111] p-4 bg-white flex flex-col justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#444444]">
                    DAILY STEPS
                  </span>
                  <span className="text-4xl font-extrabold tracking-tight mt-1">
                    {stepsFormatted}
                  </span>
                </div>

                <div className="border-2 border-[#111111] p-4 bg-white flex flex-col justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#444444]">
                    HIGH STRESS
                  </span>
                  <span className="text-4xl font-extrabold tracking-tight mt-1">
                    {data.oura?.stress}
                    <span className="text-lg font-bold ml-0.5">m</span>
                  </span>
                </div>
              </div>
            </div>

            {/* WIDGET 5: 7-DAY SLEEP TREND */}
            <div className="border-[3px] border-[#111111] bg-white p-6 flex flex-col justify-between flex-1 min-h-0">
              <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Moon className="w-5 h-5 stroke-[2.5]" />
                  <span className="text-sm font-extrabold uppercase tracking-[0.18em]">
                    05 / 7-DAY SLEEP TREND
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  {sleepChart.avgHours && (
                    <span className="px-2.5 py-1 border-2 border-[#111111] bg-[#FAF9F5]">
                      {sleepChart.avgHours}H AVG
                    </span>
                  )}
                  {sleepChart.avgScore && (
                    <span className="px-2.5 py-1 bg-[#111111] text-white">
                      {sleepChart.avgScore} SCORE
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center pt-4">
                {sleepChart.points.length > 0 ? (
                  <svg
                    viewBox={`0 0 ${sleepChart.width} ${sleepChart.height}`}
                    className="w-full h-full overflow-visible"
                  >
                    {/* 8h Target Dashed Line */}
                    <line
                      x1={sleepChart.padLeft - 14}
                      y1={sleepChart.target8hY}
                      x2={sleepChart.width - sleepChart.padRight + 14}
                      y2={sleepChart.target8hY}
                      stroke="#555555"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                    />
                    <text
                      x={sleepChart.width - sleepChart.padRight + 20}
                      y={sleepChart.target8hY + 5}
                      fill="#222222"
                      fontSize="13"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      8H
                    </text>

                    {/* 6h Reference Line */}
                    <line
                      x1={sleepChart.padLeft - 14}
                      y1={sleepChart.target6hY}
                      x2={sleepChart.width - sleepChart.padRight + 14}
                      y2={sleepChart.target6hY}
                      stroke="#CCCCCC"
                      strokeWidth="1.5"
                      strokeDasharray="3 5"
                    />
                    <text
                      x={sleepChart.width - sleepChart.padRight + 20}
                      y={sleepChart.target6hY + 5}
                      fill="#777777"
                      fontSize="12"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      6H
                    </text>

                    {/* Area Fill */}
                    <path d={sleepChart.areaD} fill="#E5E4DF" fillOpacity="0.7" />

                    {/* Bold Monochrome Curve */}
                    <path
                      d={sleepChart.curveD}
                      fill="none"
                      stroke="#111111"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Nodes & Labels */}
                    {sleepChart.points.map((pt, i) => (
                      <g key={i}>
                        <rect
                          x={pt.x - 30}
                          y={pt.y - 33}
                          width="60"
                          height="20"
                          rx="3"
                          fill="#FFFFFF"
                          stroke="#111111"
                          strokeWidth="1.5"
                        />
                        <text
                          x={pt.x}
                          y={pt.y - 19}
                          textAnchor="middle"
                          fill="#111111"
                          fontSize="13.5"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {pt.timeStr}
                        </text>

                        {pt.isLatest && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="12"
                            fill="none"
                            stroke="#111111"
                            strokeWidth="2.5"
                          />
                        )}

                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={pt.isLatest ? 7 : 6}
                          fill={pt.isLatest ? '#111111' : '#FFFFFF'}
                          stroke="#111111"
                          strokeWidth="3.5"
                        />

                        <text
                          x={pt.x}
                          y={sleepChart.bottomY + 28}
                          textAnchor="middle"
                          fill="#111111"
                          fontSize="15"
                          fontWeight="800"
                        >
                          {pt.label}
                        </text>

                        <text
                          x={pt.x}
                          y={sleepChart.bottomY + 48}
                          textAnchor="middle"
                          fill="#555555"
                          fontSize="13"
                          fontWeight="700"
                          fontFamily="monospace"
                        >
                          {pt.sleepScore > 0 ? `${pt.sleepScore}pt` : '--'}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div className="text-base font-bold text-[#666666]">
                    No sleep history available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (7 COLS): CALENDAR SCHEDULE (TOP) + TASKS & REMINDERS (BOTTOM) */}
          <div className="col-span-7 flex flex-col gap-6 min-h-0">
            {/* WIDGET 6: CALENDAR SCHEDULE */}
            <div className="border-[3px] border-[#111111] bg-white p-6 flex flex-col justify-between flex-1 min-h-0">
              <div>
                <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 stroke-[2.5]" />
                    <span className="text-sm font-extrabold uppercase tracking-[0.18em]">
                      06 / CALENDAR SCHEDULE
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-[#111111] text-white text-xs font-mono font-bold uppercase">
                    {scheduleGroups.eventsLeftToday} LEFT TODAY
                  </span>
                </div>

                {scheduleGroups.groups.length > 0 ? (
                  <div className="flex flex-col gap-3.5">
                    {scheduleGroups.groups.map((group) => (
                      <div key={group.iso} className="flex flex-col">
                        <div className="flex items-center justify-between border-b-2 border-[#111111]/20 pb-1 mb-1.5">
                          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#111111]">
                            {group.dateLabel}
                          </span>
                          {group.isToday && (
                            <span className="text-xs font-mono font-bold text-[#444444]">
                              ACTIVE DAY
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col divide-y divide-[#111111]/15">
                          {group.items.map((ev, idx) => {
                            const evTime = new Date(ev.start).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: RM_TZ,
                            });
                            const nowMs = now ? now.getTime() : 0;
                            const startMs = new Date(ev.start).getTime();
                            const endMs = ev.end ? new Date(ev.end).getTime() : startMs + 3600000;
                            const isActive = startMs <= nowMs && endMs > nowMs;
                            const academic = isAcademicEvent(ev.summary);
                            const tag = getEventTypeTag(ev.summary);

                            return (
                              <div
                                key={idx}
                                className={`py-2.5 px-3 flex items-center justify-between gap-4 ${
                                  isActive ? 'bg-[#111111] text-white' : ''
                                }`}
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <span
                                    className={`font-mono text-lg font-extrabold tabular-nums shrink-0 ${
                                      isActive ? 'text-white' : 'text-[#111111]'
                                    }`}
                                  >
                                    {evTime}
                                  </span>
                                  <span
                                    className={`text-xl font-bold truncate ${
                                      academic ? 'underline decoration-2 underline-offset-4' : ''
                                    }`}
                                  >
                                    {ev.summary}
                                  </span>
                                  {ev.location && (
                                    <span
                                      className={`text-sm font-medium truncate ${
                                        isActive ? 'text-white/80' : 'text-[#555555]'
                                      }`}
                                    >
                                      • {ev.location}
                                    </span>
                                  )}
                                </div>

                                <span
                                  className={`px-2.5 py-0.5 text-xs font-mono font-bold uppercase shrink-0 border ${
                                    isActive
                                      ? 'border-white bg-white text-[#111111]'
                                      : ev.calendar === 'Uni'
                                        ? 'border-[#111111] bg-[#111111] text-white'
                                        : 'border-[#111111] bg-[#FAF9F5] text-[#111111]'
                                  }`}
                                >
                                  {isActive ? 'LIVE' : tag}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-lg font-bold text-[#666666]">
                    No upcoming events on Main or University calendars
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#111111]/15 flex items-center justify-between text-xs font-mono text-[#555555]">
                <span>MAIN + UNIVERSITY FEEDS</span>
                <span>NEXT 21 DAYS</span>
              </div>
            </div>

            {/* WIDGET 7: REMINDERS & TASKS (2-COLUMN LANDSCAPE GRID) */}
            <div className="border-[3px] border-[#111111] bg-white p-6 flex flex-col justify-between flex-1 min-h-0">
              <div>
                <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 stroke-[2.5]" />
                    <span className="text-sm font-extrabold uppercase tracking-[0.18em]">
                      07 / TASKS &amp; REMINDERS
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-[#111111] text-white text-xs font-mono font-bold uppercase">
                    {remindersModel.leftToday} DUE TODAY
                  </span>
                </div>

                {remindersModel.items.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {remindersModel.items.map(({ item, meta }, idx) => {
                      const listName = getReminderListLabel(item.list || item.listName);
                      return (
                        <div
                          key={item.id || idx}
                          className="py-2.5 px-2 flex items-center justify-between gap-3 border-b border-[#111111]/15"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-5 h-5 border-2 border-[#111111] bg-white shrink-0" />
                            <div className="min-w-0">
                              <div className="text-lg font-bold text-[#111111] truncate leading-snug">
                                {item.title || item.text}
                              </div>
                              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#555555]">
                                {listName}
                              </div>
                            </div>
                          </div>

                          {meta.label && (
                            <span
                              className={`px-2 py-0.5 text-xs font-mono font-bold uppercase shrink-0 border-2 border-[#111111] ${
                                meta.isOverdue
                                  ? 'bg-[#111111] text-white'
                                  : meta.isToday
                                    ? 'bg-[#EBEAE4] text-[#111111]'
                                    : 'bg-white text-[#333333]'
                              }`}
                            >
                              {meta.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-lg font-bold text-[#666666]">
                    All tasks &amp; reminders complete
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#111111]/15 flex items-center justify-between text-xs font-mono text-[#555555]">
                <span>APPLE REMINDERS EVENTKIT SYNC</span>
                <span>2-COLUMN PRIORITY GRID</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

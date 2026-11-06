'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Sun,
  CloudRain,
  ArrowRight,
  Cake,
  Sparkles,
  GraduationCap,
  MapPin,
  Users,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

export default function AmbientDashboard() {
  const [now, setNow] = useState<Date | null>(null);
  const [data, setData] = useState<any>({
    weather: { temp: '--', precipitation: 0, aqi: '--' },
    oura: { readiness: '--', sleep: '--', steps: '--', stress: '--', history: [] },
    events: [],
    news: [],
    reminders: [], // Added reminders default state
  });

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
        
        // Fetch Apple Reminders from the API endpoint we created
        const remRes = await fetch('/api/reminders', { cache: 'no-store' });
        if (remRes.ok) {
          const remJson = await remRes.json();
          setData((prev: any) => ({
            ...prev,
            reminders: Array.isArray(remJson) ? remJson : (remJson.items || []),
          }));
        }
      } catch (e) {
        console.error('Failed to fetch dashboard data:', e);
      }
    };
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 300000);
    return () => clearInterval(interval);
  }, []);

  const getCountdown = (targetIso: string) => {
    if (!now) return '--d --h';
    const diff = new Date(targetIso).getTime() - now.getTime();
    if (diff <= 0) return '0d 0h';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return `${d}d ${h}h`;
  };

  const getRelativeTime = (dateStr: string) => {
    if (!now) return '';
    const diff = new Date(dateStr).getTime() - now.getTime();
    if (diff <= 0) return 'Now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs < 24) return `in ${hrs}h ${remMins}m`;
    const days = Math.floor(hrs / 24);
    return `in ${days}d ${hrs % 24}h`;
  };

  const getEventBadge = (summary: string = '') => {
    const s = summary.toLowerCase();
    if (s.includes('walk') || s.includes('->') || s.includes('→') || s.includes('transit') || s.includes('train') || s.includes('drive')) {
      return {
        label: 'TRAVEL',
        icon: MapPin,
        classes: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
      };
    }
    if (s.includes('lecture')) {
      return {
        label: 'LECTURE',
        icon: GraduationCap,
        classes: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      };
    }
    if (s.includes('seminar')) {
      return {
        label: 'SEMINAR',
        icon: Users,
        classes: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      };
    }
    if (s.includes('tutorial')) {
      return {
        label: 'TUTORIAL',
        icon: BookOpen,
        classes: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      };
    }
    return {
      label: 'EVENT',
      icon: Calendar,
      classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    };
  };

  const timeString = now
    ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const dateString = now
    ? now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()
    : 'LOADING...';

  const history: any[] = data.oura?.history || [];
  const validHours = history.filter((d) => d.hours > 0);
  const avgHours =
    validHours.length > 0
      ? (validHours.reduce((acc, d) => acc + d.hours, 0) / validHours.length).toFixed(1)
      : '0.0';

  const stepsFormatted =
    typeof data.oura?.steps === 'number'
      ? data.oura.steps.toLocaleString('en-GB')
      : data.oura?.steps ?? '--';

  const nextEvent = data.events && data.events.length > 0 ? data.events[0] : null;

  const groupedEvents: Record<string, { badge?: string; dateLabel: string; isToday: boolean; items: any[] }> = {};
  if (now && data.events) {
    const todayIso = now.toISOString().split('T')[0];
    const tomDate = new Date(now);
    tomDate.setDate(tomDate.getDate() + 1);
    const tomorrowIso = tomDate.toISOString().split('T')[0];

    data.events.slice(0, 8).forEach((ev: any) => {
      const evDate = new Date(ev.start);
      const iso = evDate.toISOString().split('T')[0];
      const formattedDate = evDate
        .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
        .toUpperCase();

      if (!groupedEvents[iso]) {
        let badge: string | undefined = undefined;
        if (iso === todayIso) badge = 'TODAY';
        else if (iso === tomorrowIso) badge = 'TOMORROW';
        groupedEvents[iso] = {
          badge,
          dateLabel: formattedDate,
          isToday: iso === todayIso,
          items: [],
        };
      }
      groupedEvents[iso].items.push(ev);
    });
  }

    // Map Apple Reminders list names to your custom color themes
  const getReminderListStyle = (rawList: any = '') => {
    const listName = (typeof rawList === 'string' ? rawList : rawList?.title || rawList?.name || 'General').trim();
    const l = listName.toLowerCase();

    if (l.includes('household')) {
      return {
        name: 'Household',
        classes: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        borderLeft: 'border-l-amber-400',
        dot: 'bg-amber-400',
      };
    }
    if (l.includes('health')) {
      return {
        name: 'Health',
        classes: 'bg-red-500/20 text-red-300 border-red-500/30',
        borderLeft: 'border-l-red-500',
        dot: 'bg-red-500',
      };
    }
    if (l.includes('finance')) {
      return {
        name: 'Finances',
        classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        borderLeft: 'border-l-emerald-400',
        dot: 'bg-emerald-400',
      };
    }
    if (l.includes('work')) {
      return {
        name: 'Work',
        classes: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
        borderLeft: 'border-l-neutral-400',
        dot: 'bg-neutral-400',
      };
    }
    if (l.includes('shopping')) {
      return {
        name: 'Shopping',
        classes: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
        borderLeft: 'border-l-sky-400',
        dot: 'bg-sky-400',
      };
    }
    if (l.includes('uni misc') || l.includes('uni')) {
      return {
        name: 'Uni Misc',
        classes: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        borderLeft: 'border-l-purple-500',
        dot: 'bg-purple-400',
      };
    }
    if (l.includes('duglj')) {
      return {
        name: 'DUGLJ',
        classes: 'bg-blue-900/40 text-blue-300 border-blue-600/40',
        borderLeft: 'border-l-blue-600',
        dot: 'bg-blue-600',
      };
    }
    if (l.includes('exam')) {
      return {
        name: 'Exams',
        classes: 'bg-red-600/20 text-red-300 border-red-500/30',
        borderLeft: 'border-l-red-600',
        dot: 'bg-red-600',
      };
    }
    return {
      name: listName || 'Task',
      classes: 'bg-white/10 text-neutral-300 border-white/10',
      borderLeft: 'border-l-neutral-500',
      dot: 'bg-neutral-400',
    };
  };

  // Filter strictly for tasks due TODAY, then sort chronologically by deadline
  const todayDateStr = now ? now.toLocaleDateString('en-CA') : ''; // YYYY-MM-DD
  const reminders = (data.reminders || [])
    .filter((item: any) => {
      if (!item.dueDate) return false;
      const itemDateStr = new Date(item.dueDate).toLocaleDateString('en-CA');
      return itemDateStr === todayDateStr;
    })
    .sort((a: any, b: any) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  
  
  return (
    <main className="h-screen w-screen overflow-hidden bg-[#070B14] text-white p-6 flex flex-col justify-between gap-5 select-none font-sans">
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          display: flex;
          width: max-content;
          animation: ticker 45s linear infinite;
        }
      `}</style>

      {/* TOP BAR */}
      <header className="grid grid-cols-12 gap-4 items-stretch shrink-0 pb-4 border-b border-white/10">
        <div className="col-span-3 flex flex-col justify-center">
          <div className="text-7xl font-black tracking-tight leading-none text-white">
            {timeString}
          </div>
          <div className="text-base font-bold tracking-widest text-neutral-400 uppercase mt-2">
            {dateString}
          </div>
        </div>

        <div className="col-span-4 bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-3.5 flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
            <ArrowRight className="w-6 h-6 text-sky-400" />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-xs font-extrabold tracking-wider text-sky-400 uppercase">
                Next Up
              </span>
              {nextEvent && (
                <span className="text-xs font-mono font-bold bg-sky-500/20 text-sky-300 px-2.5 py-0.5 rounded-md border border-sky-500/30">
                  {getRelativeTime(nextEvent.start)}
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-white truncate">
              {nextEvent ? nextEvent.summary : 'No upcoming events'}
            </div>
          </div>
        </div>

        <div className="col-span-5 grid grid-cols-4 gap-3 items-stretch">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-3 flex items-center gap-3">
            <Cake className="w-6 h-6 text-pink-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xl font-extrabold text-white font-mono leading-tight whitespace-nowrap">
                {getCountdown('2026-12-03T00:00:00')}
              </div>
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mt-1 whitespace-nowrap">
                Birthday • 03/12
              </div>
            </div>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-3 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xl font-extrabold text-white font-mono leading-tight whitespace-nowrap">
                {getCountdown('2026-12-09T17:00:00')}
              </div>
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mt-1 whitespace-nowrap">
                Xmas • 09/12
              </div>
            </div>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-3 flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xl font-extrabold text-white font-mono leading-tight whitespace-nowrap">
                {getCountdown('2027-03-19T17:00:00')}
              </div>
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mt-1 whitespace-nowrap">
                Uni End • 19/03
              </div>
            </div>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-center gap-3">
            {Number(data.weather?.precipitation) > 0 ? (
              <CloudRain className="w-8 h-8 text-sky-400 shrink-0" />
            ) : (
              <Sun className="w-8 h-8 text-amber-400 shrink-0" />
            )}
            <div>
              <div className="text-3xl font-extrabold text-white leading-none">
                {data.weather?.temp}°C
              </div>
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mt-1.5 whitespace-nowrap">
                AQI: {data.weather?.aqi} • {Number(data.weather?.precipitation) > 0 ? 'RAIN' : 'DRY'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">
        {/* LEFT COLUMN: OURA */}
        <div className="col-span-4 flex flex-col gap-5 min-h-0">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex flex-col justify-between shrink-0">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-sm tracking-wider uppercase text-neutral-300">
                Oura Biometrics (Today)
              </span>
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-black/40 border border-white/5 rounded-2xl px-4 py-4 flex items-center justify-between">
                <span className="text-sm font-bold tracking-wider text-neutral-300 uppercase">
                  Readiness
                </span>
                <span className="text-4xl font-extrabold text-amber-400 font-mono">
                  {data.oura?.readiness}
                </span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl px-4 py-4 flex items-center justify-between">
                <span className="text-sm font-bold tracking-wider text-neutral-300 uppercase">
                  Sleep
                </span>
                <span className="text-4xl font-extrabold text-indigo-400 font-mono">
                  {data.oura?.sleep}
                </span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl px-4 py-4 flex items-center justify-between">
                <span className="text-sm font-bold tracking-wider text-neutral-300 uppercase">
                  Steps
                </span>
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                  {stepsFormatted}
                </span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl px-4 py-4 flex items-center justify-between">
                <span className="text-sm font-bold tracking-wider text-neutral-300 uppercase">
                  Stress
                </span>
                <span className="text-4xl font-extrabold text-rose-400 font-mono">
                  {data.oura?.stress}
                  <span className="text-lg font-bold text-neutral-400 ml-0.5">m</span>
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex flex-col justify-between flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm tracking-wider uppercase text-neutral-300">
                  7-Day Oura Trends
                </span>
                <span className="text-xs bg-white/10 text-neutral-200 px-2.5 py-0.5 rounded-md font-mono font-bold">
                  Avg {avgHours}h
                </span>
              </div>
              <BarChart3 className="w-5 h-5 text-indigo-400" />
            </div>

            <div className="grid grid-cols-2 gap-3.5 flex-1 min-h-0">
              <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-neutral-300 font-bold uppercase tracking-wider mb-2 shrink-0">
                  <span className="truncate">Sleep vs Ready</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>S
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>R
                    </span>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-1.5 flex-1 min-h-0 pt-2">
                  {history.length > 0 ? (
                    history.map((d, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center flex-1 min-w-0 h-full justify-end"
                      >
                        <div className="flex items-end justify-center gap-[2px] w-full flex-1 min-h-0">
                          <div
                            className="flex-1 max-w-[10px] bg-indigo-400 rounded-t-sm transition-all duration-500"
                            style={{ height: `${Math.max(d.sleep || 8, 8)}%` }}
                          />
                          <div
                            className="flex-1 max-w-[10px] bg-amber-400 rounded-t-sm transition-all duration-500"
                            style={{ height: `${Math.max(d.readiness || 8, 8)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-neutral-400 font-mono mt-1.5 uppercase font-bold leading-none">
                          {d.label}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-neutral-500 m-auto">Syncing...</span>
                  )}
                </div>
              </div>

              <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-neutral-300 font-bold uppercase tracking-wider mb-2 shrink-0">
                  <span className="truncate">Hours Asleep</span>
                  <span className="text-emerald-400 font-mono shrink-0">8h Goal</span>
                </div>

                <div className="flex items-end justify-between gap-1.5 flex-1 min-h-0 pt-2">
                  {history.length > 0 ? (
                    history.map((d, i) => {
                      const heightPct = Math.min(Math.max((d.hours / 10) * 100, 10), 100);
                      const hitGoal = d.hours >= 7.5;
                      return (
                        <div
                          key={i}
                          className="flex flex-col items-center flex-1 min-w-0 h-full justify-end"
                        >
                          <span className="text-[10px] text-neutral-200 font-mono mb-1 font-bold leading-none tracking-tighter">
                            {d.hours > 0 ? d.hours : ''}
                          </span>
                          <div className="w-full flex justify-center items-end flex-1 min-h-0 px-0.5">
                            <div
                              className={`w-full max-w-[16px] rounded-t-sm transition-all duration-500 ${
                                hitGoal ? 'bg-emerald-400' : 'bg-sky-400/80'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-neutral-400 font-mono mt-1.5 uppercase font-bold leading-none">
                            {d.label}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-sm text-neutral-500 m-auto">Syncing...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

                {/* RIGHT COLUMN: SPLIT EVENLY INTO SCHEDULE AND REMINDERS */}
        <div className="col-span-8 flex flex-col gap-5 min-h-0">
          {/* LIVE SCHEDULE (Takes 50% height) */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-4">
                <span className="font-bold text-sm tracking-wider uppercase text-neutral-300">
                  Live Schedule
                </span>
                <div className="flex items-center gap-3 text-xs font-bold text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>Main
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>Uni
                  </span>
                </div>
              </div>
              <Calendar className="w-5 h-5 text-sky-400" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {Object.values(groupedEvents).length > 0 ? (
                Object.values(groupedEvents).map((group, gIdx) => (
                  <div key={gIdx} className="space-y-2">
                    <div className="flex items-center gap-3">
                      {group.badge && (
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded tracking-wider uppercase ${
                            group.isToday
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-white/10 text-neutral-200'
                          }`}
                        >
                          {group.badge}
                        </span>
                      )}
                      <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                        {group.dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-white/10"></div>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((ev: any, idx: number) => {
                        const badge = getEventBadge(ev.summary);
                        const BadgeIcon = badge.icon;
                        const isUni = ev.calendar === 'Uni';
                        const evTime = new Date(ev.start).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <div
                            key={idx}
                            className={`bg-black/45 border border-white/5 border-l-4 ${
                              isUni ? 'border-l-purple-500' : 'border-l-rose-500'
                            } rounded-xl px-4 py-2.5 flex items-center justify-between gap-3`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`text-[11px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-md border flex items-center gap-1.5 shrink-0 min-w-[95px] justify-center ${badge.classes}`}
                              >
                                <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
                                {badge.label}
                              </span>
                              <span className="text-base font-bold text-white tracking-tight truncate">
                                {ev.summary}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {group.isToday && (
                                <span className="text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                                  {getRelativeTime(ev.start)}
                                </span>
                              )}
                              <span className="text-base font-mono font-bold text-neutral-200">
                                {evTime}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-neutral-500 m-auto flex items-center justify-center h-full">
                  No upcoming schedule items
                </div>
              )}
            </div>
          </div>

          {/* APPLE REMINDERS (Takes 50% height, 2 Columns) */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm tracking-wider uppercase text-neutral-300">
                  Today's Reminders
                </span>
                <span className="text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2.5 py-0.5 rounded-md font-mono font-bold">
                  {reminders.length} Due Today
                </span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-sky-400" />
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {reminders.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5 content-start">
                  {reminders.map((item: any, idx: number) => {
                    const listStyle = getReminderListStyle(item.list || item.listName);
                    const dueDateObj = new Date(item.dueDate);
                    const hasTime =
                      !isNaN(dueDateObj.getTime()) &&
                      (dueDateObj.getHours() !== 0 || dueDateObj.getMinutes() !== 0);
                    const dueTime = hasTime
                      ? dueDateObj.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'All day';

                    return (
                      <div
                        key={idx}
                        className={`bg-black/45 border border-white/5 border-l-4 ${listStyle.borderLeft} rounded-xl px-3 py-2 flex items-center justify-between gap-2.5 min-w-0`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* List Badge */}
                          <span
                            className={`text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded border flex items-center gap-1.5 shrink-0 ${listStyle.classes}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${listStyle.dot}`}></span>
                            {listStyle.name}
                          </span>

                          {/* Title */}
                          <span className="text-sm font-bold text-white tracking-tight truncate">
                            {item.title || item.text || 'Untitled Reminder'}
                          </span>
                        </div>

                        {/* Due Time & Relative Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          {hasTime && (
                            <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                              {getRelativeTime(item.dueDate)}
                            </span>
                          )}
                          <span className="text-xs font-mono font-bold text-neutral-300">
                            {dueTime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm font-semibold text-neutral-500 m-auto flex items-center justify-center h-full">
                  All done! No remaining reminders due today
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: BBC NEWS TICKER */}
      <footer className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-4 shrink-0 overflow-hidden">
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 px-3 py-1 rounded-lg text-xs font-extrabold tracking-wider uppercase flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          BBC News
        </div>

        <div className="overflow-hidden flex-1 relative">
          {data.news && data.news.length > 0 ? (
            <div className="animate-ticker items-center">
              {[...data.news, ...data.news].map((headline: string, i: number) => (
                <div key={i} className="flex items-center gap-3 mr-12 shrink-0">
                  <span className="text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded">
                    BBC
                  </span>
                  <span className="text-base font-semibold text-neutral-200 whitespace-nowrap">
                    {headline}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm text-neutral-500">Loading headlines...</span>
          )}
        </div>
      </footer>
    </main>
  );
}


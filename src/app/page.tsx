'use client';
import { useEffect, useState } from 'react';
import { Activity, Sun, Calendar as CalIcon, BookOpen, GraduationCap, Users, MapPin, BarChart3, Cake, Sparkles, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [theme, setTheme] = useState({ bg: 'from-[#07090e] to-[#0f141c]', accent: 'text-blue-400' });

  useEffect(() => {
    const updateEngine = () => {
      const current = new Date();
      setNow(current);
      
      const hour = current.getHours();
      if (hour >= 5 && hour < 10) setTheme({ bg: 'from-[#0f0d0a] to-[#1c140d]', accent: 'text-amber-400' });
      else if (hour >= 10 && hour < 18) setTheme({ bg: 'from-[#07090e] to-[#111827]', accent: 'text-blue-400' });
      else if (hour >= 18 && hour < 22) setTheme({ bg: 'from-[#0b0813] to-[#160f24]', accent: 'text-purple-400' });
      else setTheme({ bg: 'from-[#030407] to-[#0a0d14]', accent: 'text-indigo-400' });
    };
    updateEngine();
    const interval = setInterval(updateEngine, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/dashboard');
        setData(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
    const poll = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(poll);
  }, []);

  const getCountdown = (targetIso: string) => {
    if (!now) return { days: '--', hours: '--' };
    const diff = new Date(targetIso).getTime() - now.getTime();
    if (diff <= 0) return { days: '0', hours: '0' };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)).toString(),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24).toString(),
    };
  };

  const bday = getCountdown('2026-12-03T00:00:00');
  const xmas = getCountdown('2026-12-09T17:00:00');
  const uniEnd = getCountdown('2027-03-19T17:00:00');

  const parseEventType = (summary: string) => {
    const lower = summary.toLowerCase();
    if (lower.includes('walk') || lower.includes('home ->') || lower.includes('-> home')) {
      return { label: 'TRANSIT', icon: MapPin, color: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30' };
    }
    if (lower.includes('lecture')) return { label: 'LECTURE', icon: GraduationCap, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    if (lower.includes('seminar')) return { label: 'SEMINAR', icon: Users, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    if (lower.includes('tutorial') || lower.includes('class')) return { label: 'TUTORIAL', icon: BookOpen, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    return { label: 'EVENT', icon: CalIcon, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  };

  const cleanSummary = (summary: string) => summary.replace(/^\[.*?\]\s*/, '');

  const getNextUpEvent = () => {
    if (!data?.events || data.events.length === 0 || !now) return null;
    const futureEvents = data.events.filter((e: any) => new Date(e.start).getTime() > now.getTime());
    if (futureEvents.length === 0) return null;
    return futureEvents[0];
  };

  const nextEvt = getNextUpEvent();
  const nextEvtTime = nextEvt ? new Date(nextEvt.start) : null;
  const nextEvtMins = nextEvtTime && now ? Math.ceil((nextEvtTime.getTime() - now.getTime()) / 60000) : 0;

  const getTodayCountdown = (startStr: string) => {
    if (!now) return null;
    const evtDate = new Date(startStr);
    if (evtDate.toDateString() !== now.toDateString()) return null;

    const diffMins = Math.ceil((evtDate.getTime() - now.getTime()) / 60000);
    if (diffMins <= 0 && diffMins > -60) return 'NOW';
    if (diffMins > 0 && diffMins < 60) return `in ${diffMins}m`;
    if (diffMins >= 60) {
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return mins > 0 ? `in ${hrs}h ${mins}m` : `in ${hrs}h`;
    }
    return null;
  };

  const formatDayHeader = (dateStr: string) => {
    const evtDate = new Date(dateStr);
    const fullDate = evtDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    if (!now) return { tag: fullDate, sub: '', isToday: false };

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (evtDate.toDateString() === now.toDateString()) return { tag: 'TODAY', sub: fullDate, isToday: true };
    if (evtDate.toDateString() === tomorrow.toDateString()) return { tag: 'TOMORROW', sub: fullDate, isToday: false };
    return { tag: fullDate, sub: '', isToday: false };
  };

  const groupedEvents: { [key: string]: { meta: any; items: any[] } } = {};
  if (data?.events) {
    data.events.forEach((evt: any) => {
      const dayKey = new Date(evt.start).toDateString();
      if (!groupedEvents[dayKey]) {
        groupedEvents[dayKey] = { meta: formatDayHeader(evt.start), items: [] };
      }
      groupedEvents[dayKey].items.push(evt);
    });
  }

  const timeStr = now ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
  const dateStr = now ? now.toLocaleDateString('en-GB', { weekday: 'long', month: 'short', day: 'numeric' }) : 'LOADING...';

  const history: any[] = data?.oura?.history || [];
  const validHours = history.filter(d => d.hours > 0);
  const avgHours = validHours.length > 0
    ? (validHours.reduce((acc, d) => acc + d.hours, 0) / validHours.length).toFixed(1)
    : '--';

  return (
    <main className={`w-screen h-screen bg-gradient-to-br ${theme.bg} text-[#f4f4f6] px-10 py-8 flex flex-col justify-between select-none overflow-hidden font-sans transition-colors duration-1000`}>
      
      {/* HEADER */}
      <header className="flex justify-between items-center border-b border-white/10 pb-5 shrink-0">
        
        {/* LEFT: TIME & DATE */}
        <div>
          <h1 className="text-7xl font-black tracking-tight leading-none">{timeStr}</h1>
          <p className="text-lg text-neutral-400 font-medium tracking-wide mt-2 uppercase">{dateStr}</p>
        </div>

        {/* MIDDLE: NEXT UP PILL */}
        <div className="flex items-center gap-4">
          {nextEvt && (
            <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <ArrowRight className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Next Up</span>
                  <span className="text-[10px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full font-mono">
                    {nextEvtMins < 60 ? `in ${nextEvtMins}m` : `in ${Math.floor(nextEvtMins / 60)}h ${nextEvtMins % 60}m`}
                  </span>
                </div>
                <div className="text-sm font-bold text-neutral-100 truncate max-w-[260px]">
                  {cleanSummary(nextEvt.summary)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: COUNTDOWNS & WEATHER */}
        <div className="flex items-center gap-3">
          <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Cake className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="text-base font-black font-mono leading-tight">{bday.days}d {bday.hours}h</div>
              <div className="text-[9px] tracking-wider uppercase text-neutral-400 font-semibold mt-0.5">Birthday • 03/12</div>
            </div>
          </div>

          <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-base font-black font-mono leading-tight">{xmas.days}d {xmas.hours}h</div>
              <div className="text-[9px] tracking-wider uppercase text-neutral-400 font-semibold mt-0.5">Xmas • 09/12</div>
            </div>
          </div>

          <div className="bg-white/5 px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <div className="text-base font-black font-mono leading-tight">{uniEnd.days}d {uniEnd.hours}h</div>
              <div className="text-[9px] tracking-wider uppercase text-neutral-400 font-semibold mt-0.5">Uni End • 19/03</div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-2xl border border-white/10 ml-1">
            <Sun className="w-8 h-8 text-amber-400" />
            <div>
              <div className="text-3xl font-bold leading-none">{data?.weather?.temp ?? '--'}°C</div>
              <div className="text-[10px] tracking-wider uppercase text-neutral-400 flex items-center gap-2 mt-1">
                <span>AQI: {data?.weather?.aqi ?? '--'}</span>
                <span>•</span>
                <span className={data?.weather?.precipitation > 0 ? "text-blue-400 font-bold" : "text-neutral-400"}>
                  {data?.weather?.precipitation > 0 ? `Rain (${data.weather.precipitation}mm)` : "Dry"}
                </span>
              </div>
            </div>
          </div>
        </div>

      </header>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-12 gap-8 my-auto h-[64vh]">
        
        {/* LEFT COLUMN: OURA & 7-DAY GRAPHS */}
        <div className="col-span-4 flex flex-col gap-6 h-full">
          
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col justify-between flex-1">
            <div className="flex items-center justify-between text-neutral-400 mb-2 shrink-0">
              <span className="font-semibold text-xs tracking-wider uppercase">Oura Biometrics (Today)</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 flex-grow">
              <div className="bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[15px] text-neutral-400 font-bold tracking-wider">READINESS</span>
                <span className="text-2xl font-black text-amber-400">{data?.oura?.readiness ?? '--'}</span>
              </div>
              <div className="bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[15px] text-neutral-400 font-bold tracking-wider">SLEEP</span>
                <span className="text-2xl font-black text-indigo-400">{data?.oura?.sleep ?? '--'}</span>
              </div>
              <div className="bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[15px] text-neutral-400 font-bold tracking-wider">STEPS</span>
                <span className="text-2xl font-black text-emerald-400">{data?.oura?.steps && data.oura.steps !== '--' ? Number(data.oura.steps).toLocaleString() : '--'}</span>


              </div>
              <div className="bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[15px] text-neutral-400 font-bold tracking-wider">STRESS</span>
                <span className="text-2xl font-black text-rose-400">{data?.oura?.stress ?? '--'}<span className="text-xs font-normal text-neutral-400 ml-0.5">m</span></span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col justify-between flex-1 min-h-[280px]">
          <div className="flex items-center justify-between text-neutral-400 mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm tracking-wider uppercase text-white">7-Day Oura Trends</span>
              <span className="text-xs bg-white/10 text-neutral-200 px-2.5 py-1 rounded-md font-mono font-bold">Avg {avgHours}h</span>
            </div>
            <BarChart3 className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="grid grid-cols-2 gap-4 flex-grow">
            {/* Graph 1: Sleep vs Ready */}
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-neutral-300 font-bold uppercase tracking-wider mb-2">
                <span>Sleep vs Ready</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5"><span className="w-4 h-2 rounded-full bg-indigo-400"></span>S</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-2 rounded-full bg-amber-400"></span>R</span>
                </div>
              </div>

              {/* Increased height from h-20 to h-32 (128px) */}
              <div className="flex items-end justify-between gap-2 h-32 pt-3">
                {history.length > 0 ? history.map((d, i) => (
                  <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                    <div className="flex items-end gap-1 w-full justify-center h-full">
                      {/* Thickened bars from w-1.5 to w-3 */}
                      <div
                        className="w-3 bg-indigo-400 rounded-t-sm transition-all duration-500"
                        style={{ height: `${Math.max(d.sleep || 8, 8)}%` }}
                      />
                      <div
                        className="w-3 bg-amber-400 rounded-t-sm transition-all duration-500"
                        style={{ height: `${Math.max(d.readiness || 8, 8)}%` }}
                      />
                    </div>
                    {/* Increased text size for days of the week */}
                    <span className="text-[10px] text-neutral-400 font-mono mt-2 uppercase font-bold">{d.label}</span>
                  </div>
                )) : <span className="text-sm text-neutral-600 m-auto">Syncing...</span>}
              </div>
            </div>

            {/* Graph 2: Hours Asleep */}
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-neutral-300 font-bold uppercase tracking-wider mb-2">
                <span>Hours Asleep</span>
                <span className="text-emerald-400 font-mono">8h Goal</span>
              </div>

              {/* Increased height from h-20 to h-32 (128px) */}
              <div className="flex items-end justify-between gap-2 h-32 pt-3">
                {history.length > 0 ? history.map((d, i) => {
                  const heightPct = Math.min(Math.max((d.hours / 10) * 100, 10), 100);
                  const hitGoal = d.hours >= 7.5;
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                      {/* Increased text size for the hour labels */}
                      <span className="text-[11px] text-neutral-200 font-mono mb-1 font-bold">
                        {d.hours > 0 ? d.hours : ''}
                      </span>
                      <div className="w-full flex justify-center items-end h-full">
                        {/* Thickened bar from w-2.5 to w-5 */}
                        <div
                          className={`w-5 rounded-t-sm transition-all duration-500 ${hitGoal ? 'bg-emerald-400' : 'bg-sky-400/70'}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono mt-2 uppercase font-bold">{d.label}</span>
                    </div>
                  );
                }) : <span className="text-sm text-neutral-600 m-auto">Syncing...</span>}
              </div>
            </div>
          </div>
        </div>


        </div>

        {/* RIGHT COLUMN: LIVE SCHEDULE */}
        <div className="col-span-8 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-xs tracking-wider uppercase">Live Schedule</span>
              <span className="flex items-center gap-1.5 text-[10px]"><span className="w-2 h-2 rounded-full bg-red-500"></span> Main</span>
              <span className="flex items-center gap-1.5 text-[10px]"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Uni</span>
            </div>
            <CalIcon className="w-5 h-5 text-blue-400" />
          </div>

          <div className="space-y-6 overflow-y-auto pr-2 pb-2 [&::-webkit-scrollbar]:hidden">
            {Object.keys(groupedEvents).length > 0 ? (
              Object.values(groupedEvents).map(({ meta, items }, dIdx) => (
                <div key={dIdx} className="space-y-2.5">
                  
                  <div className="flex items-center gap-3 pt-1">
                    {meta.isToday ? (
                      <span className="bg-blue-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider uppercase shadow-sm shadow-blue-500/30">
                        TODAY
                      </span>
                    ) : (
                      <span className="bg-white/10 text-neutral-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase">
                        {meta.tag}
                      </span>
                    )}
                    {meta.sub && (
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                        {meta.sub}
                      </span>
                    )}
                    <div className="h-px flex-grow bg-gradient-to-r from-white/15 to-transparent"></div>
                  </div>

                  {items.map((evt: any, i: number) => {
                    const typeInfo = parseEventType(evt.summary);
                    const TypeIcon = typeInfo.icon;
                    const sourceBorderColor = evt.calendar === 'Main' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-purple-500';
                    const countdownPill = getTodayCountdown(evt.start);

                    return (
                      <div key={i} className={`flex justify-between items-center bg-black/35 px-4 py-3 rounded-xl border border-white/5 ${sourceBorderColor}`}>
                        <div className="flex items-center gap-3 truncate pr-4">
                          <span className={`px-2 py-1 rounded-md border text-[10px] font-bold tracking-wider flex items-center gap-1.5 shrink-0 ${typeInfo.color}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeInfo.label}
                          </span>
                          <span className="font-medium text-base truncate text-neutral-100">
                            {cleanSummary(evt.summary)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {countdownPill && (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                              {countdownPill}
                            </span>
                          )}
                          <span className="text-sm text-neutral-300 font-mono font-semibold">
                            {new Date(evt.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : <p className="text-neutral-500 italic mt-4 text-base">No upcoming events</p>}
          </div>
        </div>

      </div>

      {/* NEWS TICKER */}
      <footer className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 shrink-0 overflow-hidden">
        <span className="bg-red-500/20 text-red-400 font-bold px-3 py-1 rounded-md text-xs tracking-wider uppercase shrink-0 flex items-center gap-2 z-10">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          BBC News
        </span>
        <div className="overflow-hidden whitespace-nowrap relative w-full">
          <div className="inline-flex items-center animate-marquee">
            {data?.news?.length > 0 ? (
              data.news.map((headline: string, idx: number) => (
                <div key={idx} className="inline-flex items-center mr-14">
                  <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded mr-3 uppercase tracking-wider">
                    #{idx + 1}
                  </span>
                  <span className="text-sm font-medium text-neutral-200">
                    {headline}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-sm text-neutral-400">Connecting to headline services...</span>
            )}
          </div>
        </div>
      </footer>

    </main>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity, BarChart3, Calendar, Sun, CloudRain, ArrowRight,
  Cake, Sparkles, GraduationCap, MapPin, Users, BookOpen, CheckCircle2, X
} from 'lucide-react';

export default function AmbientDashboard() {
  const [now, setNow] = useState<Date | null>(null);
  const [activeModal, setActiveModal] = useState<'calendar' | 'reminders' | 'oura' | null>(null);
  const [data, setData] = useState<any>({
    weather: { temp: '--', precipitation: 0, aqi: '--' },
    oura: { readiness: '--', sleep: '--', steps: '--', stress: '--', history: [] },
    events: [],
    news: [],
    reminders: [],
  });

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, remRes] = await Promise.all([
          fetch('/api/dashboard', { cache: 'no-store' }),
          fetch('/api/reminders', { cache: 'no-store' })
        ]);
        
        if (dashRes.ok) setData((p: any) => ({ ...p, ...(await dashRes.json()) }));
        if (remRes.ok) {
          const remJson = await remRes.json();
          setData((p: any) => ({ ...p, reminders: Array.isArray(remJson) ? remJson : (remJson.items || []) }));
        }
      } catch (e) { console.error(e); }
    };
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 300000);
    return () => clearInterval(interval);
  }, []);

  // TV D-PAD LISTENER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveModal(prev => prev === 'oura' ? null : 'oura');
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setActiveModal(prev => prev === 'calendar' ? null : 'calendar');
      if (e.key === 'ArrowDown') setActiveModal(prev => prev === 'reminders' ? null : 'reminders');
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Backspace') setActiveModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getCountdown = (targetIso: string) => {
    if (!now) return '--d';
    const diff = new Date(targetIso).getTime() - now.getTime();
    if (diff <= 0) return '0d';
    return `${Math.floor(diff / 86400000)}d`;
  };

  const getRelativeTime = (dateStr: string) => {
    if (!now) return '';
    const diff = new Date(dateStr).getTime() - now.getTime();
    if (diff <= 0) return 'Now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const getEventBadge = (summary: string = '') => {
    const s = summary.toLowerCase();
    if (s.includes('walk') || s.includes('->') || s.includes('transit')) return { label: 'Transit', icon: MapPin, color: 'text-neutral-400', dot: 'bg-neutral-400' };
    if (s.includes('lecture')) return { label: 'Lecture', icon: GraduationCap, color: 'text-purple-400', dot: 'bg-purple-400' };
    if (s.includes('seminar')) return { label: 'Seminar', icon: Users, color: 'text-indigo-400', dot: 'bg-indigo-400' };
    if (s.includes('tutorial')) return { label: 'Tutorial', icon: BookOpen, color: 'text-sky-400', dot: 'bg-sky-400' };
    return { label: 'Event', icon: Calendar, color: 'text-emerald-400', dot: 'bg-emerald-400' };
  };

  const getReminderListStyle = (rawList: any = '') => {
    const l = (typeof rawList === 'string' ? rawList : rawList?.title || rawList?.name || 'General').trim().toLowerCase();
    if (l.includes('household')) return { name: 'Household', color: 'text-amber-400', dot: 'bg-amber-400' };
    if (l.includes('health')) return { name: 'Health', color: 'text-red-400', dot: 'bg-red-400' };
    if (l.includes('finance')) return { name: 'Finances', color: 'text-emerald-400', dot: 'bg-emerald-400' };
    if (l.includes('work')) return { name: 'Work', color: 'text-neutral-400', dot: 'bg-neutral-400' };
    if (l.includes('shopping')) return { name: 'Shopping', color: 'text-sky-400', dot: 'bg-sky-400' };
    if (l.includes('uni')) return { name: 'Uni', color: 'text-purple-400', dot: 'bg-purple-400' };
    if (l.includes('duglj')) return { name: 'DUGLJ', color: 'text-blue-500', dot: 'bg-blue-500' };
    if (l.includes('exam')) return { name: 'Exams', color: 'text-red-500', dot: 'bg-red-500' };
    return { name: l || 'Task', color: 'text-neutral-400', dot: 'bg-neutral-500' };
  };

  const timeString = now ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const dateString = now ? now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Loading...';

  const history: any[] = data.oura?.history || [];
  const avgHours = history.length > 0 ? (history.reduce((acc: any, d: any) => acc + (d.hours||0), 0) / history.length).toFixed(1) : '0.0';
  const stepsFormatted = typeof data.oura?.steps === 'number' ? data.oura.steps.toLocaleString('en-GB') : data.oura?.steps ?? '--';

  const nextEvent = data.events && data.events.length > 0 ? data.events[0] : null;

  const groupedEvents: Record<string, { dateLabel: string; isToday: boolean; items: any[] }> = {};
  if (now && data.events) {
    const todayIso = now.toISOString().split('T')[0];
    data.events.slice(0, 8).forEach((ev: any) => {
      const evDate = new Date(ev.start);
      const iso = evDate.toISOString().split('T')[0];
      const formattedDate = iso === todayIso ? 'Today' : evDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric' });
      if (!groupedEvents[iso]) {
        groupedEvents[iso] = { dateLabel: formattedDate, isToday: iso === todayIso, items: [] };
      }
      groupedEvents[iso].items.push(ev);
    });
  }

  const currentHour = now ? now.getHours() : 12;
  const isMorning = currentHour >= 6 && currentHour < 9;
  const isDeepWork = currentHour >= 9 && currentHour < 17;
  const isEvening = currentHour >= 20 || currentHour < 6;

  const leftColSpan = isDeepWork ? 'col-span-3' : 'col-span-4'; 
  const rightColSpan = isDeepWork ? 'col-span-9' : 'col-span-8';

  const todayDateStr = now ? now.toLocaleDateString('en-CA') : '';
  const todayReminders = (data.reminders || [])
    .filter((item: any) => item.dueDate && new Date(item.dueDate).toLocaleDateString('en-CA') === todayDateStr)
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // REUSABLE LIQUID GLASS CARD COMPONENT
  const GlassCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white/[0.02] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] rounded-3xl p-6 ${className}`}>
      {children}
    </div>
  );

  const renderModal = () => {
    if (!activeModal) return null;
    return (
      <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-3xl flex items-center justify-center p-12 animate-in fade-in duration-300">
        <GlassCard className="w-full h-full flex flex-col relative border-white/20">
          <button onClick={() => setActiveModal(null)} className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
            <X className="w-6 h-6" />
          </button>
          
          {activeModal === 'reminders' && (
            <div className="flex flex-col h-full">
              <h2 className="text-3xl font-semibold text-white mb-8">All Tasks</h2>
              <div className="overflow-y-auto pr-4 space-y-1">
                {data.reminders.map((r: any, i: number) => {
                   const listStyle = getReminderListStyle(r.list || r.listName);
                   return (
                    <div key={i} className="py-4 border-b border-white/5 last:border-0 flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full border-2 ${listStyle.color.replace('text', 'border')} bg-transparent`}></div>
                      <div className="font-medium text-lg flex-1 text-white/90">{r.title || r.text || 'Untitled'}</div>
                      <span className="text-sm font-medium text-white/40">{listStyle.name}</span>
                    </div>
                   )
                })}
              </div>
            </div>
          )}
          
          {activeModal === 'calendar' && (
            <div className="flex flex-col h-full">
              <h2 className="text-3xl font-semibold text-white mb-8">Calendar</h2>
              <div className="overflow-y-auto pr-4 space-y-1">
                {data.events.map((e: any, i: number) => {
                   const badge = getEventBadge(e.summary);
                   return (
                    <div key={i} className="py-4 border-b border-white/5 last:border-0 flex items-center gap-6">
                      <div className="flex flex-col min-w-[80px]">
                        <span className="text-white/90 font-medium">{new Date(e.start).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}</span>
                        <span className="text-white/40 text-sm">{new Date(e.start).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric'})}</span>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${badge.dot}`}></div>
                      <span className="font-medium text-lg text-white/90">{e.summary}</span>
                    </div>
                   )
                })}
              </div>
            </div>
          )}

          {activeModal === 'oura' && (
            <div className="flex flex-col h-full items-center justify-center">
              <Activity className="w-16 h-16 text-white/80 mb-6" />
              <h2 className="text-3xl font-semibold text-white mb-12">Health Metrics</h2>
              <div className="grid grid-cols-4 gap-8 text-center w-full max-w-4xl">
                 <div><div className="text-white/40 text-sm mb-2 font-medium">Readiness</div><div className="text-5xl font-light text-white">{data.oura.readiness}</div></div>
                 <div><div className="text-white/40 text-sm mb-2 font-medium">Sleep</div><div className="text-5xl font-light text-white">{data.oura.sleep}</div></div>
                 <div><div className="text-white/40 text-sm mb-2 font-medium">Steps</div><div className="text-5xl font-light text-white">{stepsFormatted}</div></div>
                 <div><div className="text-white/40 text-sm mb-2 font-medium">Stress</div><div className="text-5xl font-light text-white">{data.oura.stress}<span className="text-2xl text-white/40 ml-1">m</span></div></div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    );
  };

  return (
    <main className={`h-screen w-screen overflow-hidden bg-black text-white p-8 flex flex-col justify-between gap-6 select-none font-sans transition-opacity duration-1000 ${isEvening ? 'opacity-80' : 'opacity-100'}`}>
      {renderModal()}
      
      <style>{`
        @keyframes ticker { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .animate-ticker { display: flex; width: max-content; animation: ticker 60s linear infinite; }
      `}</style>

      {/* TOP HEADER: LIQUID GLASS ANCHOR */}
      <header className="grid grid-cols-12 gap-6 items-center shrink-0">
        <div className="col-span-3 flex flex-col justify-center">
          <div className="text-7xl font-medium tracking-tighter text-white/95">{timeString}</div>
          <div className="text-lg font-medium text-white/40 mt-1">{dateString}</div>
        </div>

        <GlassCard className="col-span-5 flex items-center gap-5 !p-4 !rounded-2xl transition-all duration-700">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isMorning ? 'bg-amber-400/20 text-amber-400' : isDeepWork ? 'bg-indigo-400/20 text-indigo-400' : 'bg-white/10 text-white'}`}>
            {isMorning ? <Sun className="w-5 h-5" /> : isDeepWork ? <BookOpen className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/50">
                {isMorning ? 'Morning' : isDeepWork ? 'Focus' : 'Next'}
              </span>
              {nextEvent && <span className="text-[11px] font-medium text-white/40">{getRelativeTime(nextEvent.start)}</span>}
            </div>
            <div className="text-lg font-medium text-white/90 truncate">{nextEvent ? nextEvent.summary : 'Clear Schedule'}</div>
          </div>
        </GlassCard>

        <div className="col-span-4 flex justify-end items-center gap-8 text-right">
          <div className="flex flex-col items-end">
             <div className="text-[11px] font-medium uppercase tracking-widest text-white/40 mb-1">Weather</div>
             <div className="text-3xl font-light text-white/90 flex items-center gap-2">
               {data.weather?.temp}° <Sun className="w-6 h-6 text-white/60" />
             </div>
          </div>
          <div className="w-px h-12 bg-white/10"></div>
          <div className="flex flex-col items-end">
             <div className="text-[11px] font-medium uppercase tracking-widest text-white/40 mb-1">Xmas</div>
             <div className="text-3xl font-light text-white/90">{getCountdown('2026-12-09T17:00:00')}</div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* LEFT COLUMN: OURA (Floating Text) */}
        <div className={`${leftColSpan} flex flex-col gap-6 min-h-0 transition-all duration-700`}>
          <GlassCard className="flex flex-col justify-between shrink-0 !pb-8">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-4 h-4 text-white/40" />
              <span className="font-medium text-sm text-white/40 uppercase tracking-widest">Biometrics</span>
            </div>
            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Readiness</div>
                <div className="text-4xl font-light text-white">{data.oura?.readiness}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Sleep</div>
                <div className="text-4xl font-light text-white">{data.oura?.sleep}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Steps</div>
                <div className="text-4xl font-light text-white">{stepsFormatted}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Stress</div>
                <div className="text-4xl font-light text-white">{data.oura?.stress}<span className="text-lg text-white/40 ml-0.5">m</span></div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-white/40" />
                <span className="font-medium text-sm text-white/40 uppercase tracking-widest">7-Day Trends</span>
              </div>
              <span className="text-xs text-white/40 font-medium">Avg {avgHours}h</span>
            </div>
            <div className="flex items-end justify-between gap-2 flex-1 min-h-0 pb-2">
              {history.length > 0 ? history.map((d: any, i: number) => {
                const h = Math.min(Math.max((d.hours / 10) * 100, 10), 100);
                return (
                  <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end group">
                    <span className="text-[10px] text-white/30 font-medium mb-2 opacity-0 transition-opacity">{d.hours > 0 ? d.hours : ''}</span>
                    <div className="w-full flex justify-center items-end flex-1 min-h-0 px-1">
                      <div className="w-full max-w-[12px] rounded-full transition-all duration-500 bg-white/20" style={{ height: `${h}%` }} />
                    </div>
                    <span className="text-[11px] text-white/40 font-medium mt-3 uppercase">{d.label}</span>
                  </div>
                );
              }) : <span className="text-sm text-white/40 m-auto">Syncing...</span>}
            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN: LIST ROWS (Apple Style) */}
        <div className={`${rightColSpan} flex flex-col gap-6 min-h-0 transition-all duration-700`}>
          
          {/* SCHEDULE */}
          <GlassCard className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <Calendar className="w-4 h-4 text-white/40" />
              <span className="font-medium text-sm text-white/40 uppercase tracking-widest">Schedule</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              {Object.values(groupedEvents).length > 0 ? (
                Object.values(groupedEvents).map((group, gIdx) => (
                  <div key={gIdx} className="mb-6 last:mb-0">
                    <div className="text-[11px] font-medium text-white/40 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{group.dateLabel}</div>
                    <div className="flex flex-col">
                      {group.items.map((ev: any, idx: number) => {
                        const badge = getEventBadge(ev.summary);
                        const isUni = ev.calendar === 'Uni';
                        const evTime = new Date(ev.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={idx} className="py-3 flex items-center justify-between gap-4 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="w-[45px] text-sm font-medium text-white/50">{evTime}</span>
                              <div className={`w-1.5 h-1.5 rounded-full ${isUni ? 'bg-purple-400' : 'bg-white/40'}`}></div>
                              <span className="text-lg font-medium text-white/90 truncate">{ev.summary}</span>
                            </div>
                            <span className="text-xs font-medium text-white/30">{badge.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : <div className="text-sm text-white/40 m-auto flex items-center justify-center h-full">No upcoming schedule items</div>}
            </div>
          </GlassCard>

          {/* REMINDERS */}
          <GlassCard className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white/40" />
              <span className="font-medium text-sm text-white/40 uppercase tracking-widest">Today</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              {todayReminders.length > 0 ? (
                <div className="flex flex-col">
                  {todayReminders.map((item: any, idx: number) => {
                    const listStyle = getReminderListStyle(item.list || item.listName);
                    const hasTime = !isNaN(new Date(item.dueDate).getTime()) && (new Date(item.dueDate).getHours() !== 0 || new Date(item.dueDate).getMinutes() !== 0);
                    return (
                      <div key={idx} className="py-3 flex items-center justify-between gap-4 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-3 h-3 rounded-full border-[1.5px] ${listStyle.color.replace('text', 'border')} bg-transparent`}></div>
                          <span className="text-base font-medium text-white/90 truncate">{item.title || item.text}</span>
                        </div>
                        {hasTime && <span className="text-sm font-medium text-white/40">{new Date(item.dueDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                    );
                  })}
                </div>
              ) : <div className="text-sm font-medium text-white/40 m-auto flex items-center justify-center h-full">All done for today.</div>}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* BOTTOM TICKER */}
      <GlassCard className="!p-3 !rounded-2xl shrink-0 overflow-hidden flex items-center gap-4">
        <div className="text-[10px] font-medium uppercase tracking-widest text-white/40 shrink-0 border-r border-white/10 pr-4">BBC News</div>
        <div className="overflow-hidden flex-1 relative">
          {data.news && data.news.length > 0 ? (
            <div className="animate-ticker items-center">
              {[...data.news, ...data.news].map((headline: string, i: number) => (
                <span key={i} className="text-sm font-medium text-white/70 whitespace-nowrap mr-12">{headline}</span>
              ))}
            </div>
          ) : <span className="text-sm text-white/40">Loading...</span>}
        </div>
      </GlassCard>
    </main>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity, Calendar, Sun, CloudRain, ArrowRight,
  Cake, Sparkles, GraduationCap, MapPin, Users, BookOpen, CheckCircle2, X, Mail
} from 'lucide-react';

// --- PURE CSS TICKER COMPONENT (Prevents jumping on clock updates) ---
const NewsTicker = React.memo(({ news, isEvening }: { news: any[], isEvening: boolean }) => (
  <div className={`bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] rounded-3xl p-3 shrink-0 overflow-hidden flex items-center gap-4 transition-opacity duration-1000 ${isEvening ? 'opacity-70' : 'opacity-100'}`}>
    <style>{`
      @keyframes ticker { 0% { transform: translate3d(0, 0, 0); } 100% { transform: translate3d(-50%, 0, 0); } }
      .animate-ticker { display: flex; width: max-content; animation: ticker 50s linear infinite; will-change: transform; }
    `}</style>
    <div className="text-[10px] font-medium uppercase tracking-widest text-white/40 shrink-0 border-r border-white/10 pr-4">BBC News</div>
    <div className="overflow-hidden flex-1 relative">
      {news && news.length > 0 ? (
        <div className="animate-ticker items-center">
          {[...news, ...news, ...news].map((headline: string, i: number) => (
            <span key={i} className="text-sm font-medium text-white/70 whitespace-nowrap mr-12 shrink-0">{headline}</span>
          ))}
        </div>
      ) : <span className="text-sm text-white/40">Loading...</span>}
    </div>
  </div>
));
NewsTicker.displayName = 'NewsTicker';

// --- LIVE COUNTDOWN MODAL COMPONENT (Updates every second independently) ---
const UpcomingEventModal = ({ event, onClose }: { event: any, onClose: () => void }) => {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const updateTimer = () => {
      const diff = new Date(event.start).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Starting now');
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}m ${s < 10 ? '0' : ''}${s}s`);
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [event]);

  return (
    <div className="absolute inset-0 z-50 bg-black flex items-center justify-center p-10 animate-in fade-in zoom-in duration-300">
      <div className="w-full h-full bg-[#0a0f18] border border-white/15 rounded-3xl flex flex-col items-center justify-center relative p-8 shadow-2xl text-center">
        <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
          <X className="w-6 h-6" />
        </button>
        <div className="w-24 h-24 rounded-full bg-sky-500/20 flex items-center justify-center mb-8 animate-pulse">
          <Calendar className="w-12 h-12 text-sky-400" />
        </div>
        <h2 className="text-2xl font-medium text-white/40 uppercase tracking-widest mb-4">Starting Soon</h2>
        <h1 className="text-6xl font-semibold text-white mb-8 max-w-4xl truncate">{event.summary}</h1>
        <div className="text-[120px] leading-none font-light text-sky-400 font-mono tracking-tighter">{timeLeft}</div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD ---
export default function AmbientDashboard() {
  const [now, setNow] = useState<Date | null>(null);
  const [activeModal, setActiveModal] = useState<'calendar' | 'reminders' | 'oura' | 'upcoming' | null>(null);
  const [dismissedEventKey, setDismissedEventKey] = useState<string | null>(null);
  
  const [data, setData] = useState<any>({
    weather: { temp: '--', precipitation: 0, aqi: '--' },
    oura: { readiness: '--', sleep: '--', steps: '--', stress: '--', history: [] },
    events: [],
    news: [],
    reminders: [],
    emails: { gmail: { unread: 0, total: 0 }, uni: { unread: 0, total: 0 } }
  });

  // Main UI Clock (10s updates)
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Data Fetching
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, remRes, emailRes] = await Promise.all([
          fetch('/api/dashboard', { cache: 'no-store' }),
          fetch('/api/reminders', { cache: 'no-store' }),
          fetch('/api/emails', { cache: 'no-store' })
        ]);
        
        let newData = {};
        if (dashRes.ok) newData = { ...newData, ...(await dashRes.json()) };
        if (remRes.ok) {
          const remJson = await remRes.json();
          newData = { ...newData, reminders: Array.isArray(remJson) ? remJson : (remJson.items || []) };
        }
        if (emailRes.ok) newData = { ...newData, emails: await emailRes.json() };
        setData((p: any) => ({ ...p, ...newData }));
      } catch (e) { console.error(e); }
    };
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 300000);
    return () => clearInterval(interval);
  }, []);

  const nextEvent = data.events && data.events.length > 0 ? data.events[0] : null;

  // Auto-trigger Upcoming Modal (if within 15 mins)
  useEffect(() => {
    if (nextEvent) {
      const timeTo = new Date(nextEvent.start).getTime() - Date.now();
      const eventKey = nextEvent.summary + nextEvent.start;
      
      // Open if <= 15 mins, not started yet, and not dismissed
      if (timeTo > 0 && timeTo <= 15 * 60 * 1000 && dismissedEventKey !== eventKey && activeModal !== 'upcoming') {
        setActiveModal('upcoming');
      } else if (timeTo <= 0 && activeModal === 'upcoming') {
        setActiveModal(null); // Close when event physically starts
      }
    }
  }, [now, nextEvent, dismissedEventKey, activeModal]);

  // TV D-PAD LISTENER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveModal(prev => prev === 'oura' ? null : 'oura');
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setActiveModal(prev => prev === 'calendar' ? null : 'calendar');
      if (e.key === 'ArrowDown') setActiveModal(prev => prev === 'reminders' ? null : 'reminders');
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Backspace') {
        // If closing the upcoming modal, dismiss this specific event so it doesn't pop back open
        if (activeModal === 'upcoming' && nextEvent) {
          setDismissedEventKey(nextEvent.summary + nextEvent.start);
        }
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, nextEvent]);

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
  const stepsFormatted = typeof data.oura?.steps === 'number' ? data.oura.steps.toLocaleString('en-GB') : data.oura?.steps ?? '--';

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

  const GlassCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] rounded-3xl p-6 ${className}`}>
      {children}
    </div>
  );

  const renderModal = () => {
    if (!activeModal) return null;
    if (activeModal === 'upcoming' && nextEvent) {
      return (
        <UpcomingEventModal 
          event={nextEvent} 
          onClose={() => {
            setDismissedEventKey(nextEvent.summary + nextEvent.start);
            setActiveModal(null);
          }} 
        />
      );
    }
    
    return (
      <div className="absolute inset-0 z-50 bg-black flex items-center justify-center p-10 animate-in fade-in duration-200">
        <div className="w-full h-full bg-[#0a0f18] border border-white/15 rounded-3xl flex flex-col relative p-8 shadow-2xl">
          <button onClick={() => setActiveModal(null)} className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
            <X className="w-6 h-6" />
          </button>
          
          {activeModal === 'reminders' && (
            <div className="flex flex-col h-full">
              <h2 className="text-4xl font-semibold text-white mb-8">All Tasks</h2>
              <div className="overflow-y-auto pr-4 space-y-2">
                {data.reminders.map((r: any, i: number) => {
                   const listStyle = getReminderListStyle(r.list || r.listName);
                   return (
                    <div key={i} className="py-5 px-6 bg-white/[0.04] rounded-2xl flex items-center gap-5">
                      <div className={`w-4 h-4 rounded-full border-2 ${listStyle.color.replace('text', 'border')} bg-transparent shrink-0`}></div>
                      <div className="font-medium text-xl flex-1 text-white/95">{r.title || r.text || 'Untitled'}</div>
                      <span className="text-base font-medium text-white/50 capitalize">{listStyle.name}</span>
                    </div>
                   )
                })}
              </div>
            </div>
          )}
          
          {activeModal === 'calendar' && (
            <div className="flex flex-col h-full">
              <h2 className="text-4xl font-semibold text-white mb-8">Calendar</h2>
              <div className="overflow-y-auto pr-4 space-y-2">
                {data.events.map((e: any, i: number) => {
                   const badge = getEventBadge(e.summary);
                   return (
                    <div key={i} className="py-5 px-6 bg-white/[0.04] rounded-2xl flex items-center gap-6">
                      <div className="flex flex-col min-w-[100px] shrink-0">
                        <span className="text-white/95 text-lg font-medium">{new Date(e.start).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}</span>
                        <span className="text-white/50 text-sm">{new Date(e.start).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric'})}</span>
                      </div>
                      <div className={`w-3 h-3 rounded-full shrink-0 ${badge.dot}`}></div>
                      <span className="font-medium text-xl text-white/95 truncate">{e.summary}</span>
                    </div>
                   )
                })}
              </div>
            </div>
          )}

          {activeModal === 'oura' && (
            <div className="flex flex-col h-full items-center justify-center">
              <Activity className="w-20 h-20 text-white/80 mb-8" />
              <h2 className="text-5xl font-semibold text-white mb-16">Health Metrics</h2>
              <div className="grid grid-cols-4 gap-8 text-center w-full max-w-5xl">
                 <div className="bg-white/[0.04] p-8 rounded-3xl"><div className="text-white/50 text-base mb-3 font-medium uppercase tracking-widest">Readiness</div><div className="text-6xl font-light text-white">{data.oura.readiness}</div></div>
                 <div className="bg-white/[0.04] p-8 rounded-3xl"><div className="text-white/50 text-base mb-3 font-medium uppercase tracking-widest">Sleep</div><div className="text-6xl font-light text-white">{data.oura.sleep}</div></div>
                 <div className="bg-white/[0.04] p-8 rounded-3xl"><div className="text-white/50 text-base mb-3 font-medium uppercase tracking-widest">Steps</div><div className="text-6xl font-light text-white">{stepsFormatted}</div></div>
                 <div className="bg-white/[0.04] p-8 rounded-3xl"><div className="text-white/50 text-base mb-3 font-medium uppercase tracking-widest">Stress</div><div className="text-6xl font-light text-white">{data.oura.stress}<span className="text-3xl text-white/40 ml-1">m</span></div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className={`h-screen w-screen overflow-hidden bg-black text-white p-8 flex flex-col justify-between gap-6 select-none font-sans transition-opacity duration-1000 ${isEvening ? 'opacity-80' : 'opacity-100'}`}>
      {renderModal()}
      
      {/* TOP HEADER */}
      <header className="grid grid-cols-12 gap-6 items-stretch shrink-0 h-28">
        <div className="col-span-3 flex flex-col justify-center">
          <div className="text-7xl font-medium tracking-tighter text-white/95">{timeString}</div>
          <div className="text-lg font-medium text-white/40 mt-1">{dateString}</div>
        </div>

        <GlassCard className="col-span-3 flex flex-col justify-center gap-1.5 !p-5 transition-all duration-700">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${nextEvent ? 'bg-sky-400 animate-pulse' : 'bg-white/20'}`}></div>
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/50">
              {isMorning ? 'Morning' : isDeepWork ? 'Focus' : 'Next Up'}
            </span>
          </div>
          <div className="text-xl font-medium text-white/95 truncate">
            {nextEvent ? nextEvent.summary : 'Clear Schedule'}
          </div>
          <div className="text-sm font-medium text-white/40">
            {nextEvent ? getRelativeTime(nextEvent.start) : 'Relax'}
          </div>
        </GlassCard>

        <div className="col-span-6 grid grid-cols-4 gap-5 h-full">
          <GlassCard className="!p-4 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">Weather</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-light text-white/90">{data.weather?.temp}°</span>
              <Sun className="w-5 h-5 text-white/60" />
            </div>
          </GlassCard>
          <GlassCard className="!p-4 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">Birthday</span>
            <span className="text-3xl font-light text-white/90">{getCountdown('2026-12-03T00:00:00')}</span>
          </GlassCard>
          <GlassCard className="!p-4 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">Xmas</span>
            <span className="text-3xl font-light text-white/90">{getCountdown('2026-12-09T17:00:00')}</span>
          </GlassCard>
          <GlassCard className="!p-4 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">Uni End</span>
            <span className="text-3xl font-light text-white/90">{getCountdown('2027-03-19T17:00:00')}</span>
          </GlassCard>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* LEFT COLUMN */}
        <div className={`${leftColSpan} flex flex-col gap-6 min-h-0 transition-all duration-700`}>
          <GlassCard className="flex flex-col justify-between shrink-0 !pb-6">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-white/40" />
              <span className="font-medium text-sm text-white/40 uppercase tracking-widest">Biometrics</span>
            </div>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Readiness</div>
                <div className="text-3xl font-light text-white">{data.oura?.readiness}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Sleep</div>
                <div className="text-3xl font-light text-white">{data.oura?.sleep}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Steps</div>
                <div className="text-3xl font-light text-white">{stepsFormatted}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/40 mb-1">Stress</div>
                <div className="text-3xl font-light text-white">{data.oura?.stress}<span className="text-sm text-white/40 ml-0.5">m</span></div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col shrink-0">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <Mail className="w-4 h-4 text-white/40" />
              <span className="font-medium text-sm text-white/40 uppercase tracking-widest">Inboxes</span>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/90 font-medium leading-tight">Personal</span>
                    <span className="text-white/40 text-xs">Gmail</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-rose-400 font-medium leading-tight">{data.emails?.gmail?.unread || 0} Unread</span>
                  <span className="text-white/40 text-xs">{data.emails?.gmail?.total || 0} Total</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/90 font-medium leading-tight">University</span>
                    <span className="text-white/40 text-xs">Durham</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-purple-400 font-medium leading-tight">{data.emails?.uni?.unread || 0} Unread</span>
                  <span className="text-white/40 text-xs">{data.emails?.uni?.total || 0} Total</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white/40" />
              <span className="font-medium text-sm text-white/40 uppercase tracking-widest">7-Day Sleep</span>
            </div>
            <div className="flex items-center justify-between gap-3 flex-1 min-h-0">
              {data.oura?.history && data.oura.history.length > 0 ? data.oura.history.map((d: any, i: number) => (
                <div key={i} className="flex flex-col items-center justify-center flex-1 h-full bg-white/[0.04] rounded-2xl border border-white/5 shadow-inner">
                  <span className="text-[10px] text-white/40 font-medium mb-1 uppercase tracking-widest">{d.label.substring(0,2)}</span>
                  <span className="text-lg font-light text-white/90">{d.hours > 0 ? `${d.hours}` : '-'}</span>
                </div>
              )) : <span className="text-sm text-white/40 m-auto">Syncing...</span>}
            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN */}
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
                              <span className="w-[45px] text-sm font-medium text-white/50 shrink-0">{evTime}</span>
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUni ? 'bg-purple-400' : 'bg-white/40'}`}></div>
                              <span className="text-lg font-medium text-white/95 truncate">{ev.summary}</span>
                            </div>
                            <span className="text-xs font-medium text-white/30 shrink-0">{badge.label}</span>
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
              <span className="font-medium text-sm text-white/40 uppercase tracking-widest">Today's Tasks</span>
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
                          <div className={`w-3.5 h-3.5 rounded-full border-[1.5px] shrink-0 ${listStyle.color.replace('text', 'border')} bg-transparent`}></div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-lg font-medium text-white/95 truncate leading-tight">{item.title || item.text}</span>
                            <span className="text-xs font-medium text-white/40 capitalize">{listStyle.name}</span>
                          </div>
                        </div>
                        {hasTime && <span className="text-sm font-medium text-white/40 shrink-0">{new Date(item.dueDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                    );
                  })}
                </div>
              ) : <div className="text-sm font-medium text-white/40 m-auto flex items-center justify-center h-full">All done for today.</div>}
            </div>
          </GlassCard>
        </div>
      </div>

      <NewsTicker news={data.news} isEvening={isEvening} />
    </main>
  );
}

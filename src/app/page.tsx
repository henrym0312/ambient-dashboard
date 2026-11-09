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
    events: [], news: [], reminders: [],
  });

  // 1. TIME INITIALIZATION
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. DATA FETCHING
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

  // 3. FIRE TV REMOTE LISTENER (1, 2, 3, and Back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') setActiveModal(prev => prev === 'calendar' ? null : 'calendar');
      if (e.key === '2') setActiveModal(prev => prev === 'reminders' ? null : 'reminders');
      if (e.key === '3') setActiveModal(prev => prev === 'oura' ? null : 'oura');
      if (e.key === 'Escape' || e.key === 'Backspace') setActiveModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // HELPERS (Simplified for length)
  const getRelativeTime = (dateStr: string) => { /* Same as before */ 
    if (!now) return '';
    const diff = new Date(dateStr).getTime() - now.getTime();
    if (diff <= 0) return 'Now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    if (mins < 1440) return `in ${Math.floor(mins / 60)}h`;
    return `in ${Math.floor(mins / 1440)}d`;
  };

  const getEventBadge = (s: string = '') => {
    const l = s.toLowerCase();
    if (l.includes('transit') || l.includes('walk') || l.includes('->')) return { label: 'TRANSIT', icon: MapPin, cls: 'bg-neutral-500/20 text-neutral-300' };
    if (l.includes('lecture')) return { label: 'LECTURE', icon: GraduationCap, cls: 'bg-purple-500/20 text-purple-300' };
    if (l.includes('seminar')) return { label: 'SEMINAR', icon: Users, cls: 'bg-indigo-500/20 text-indigo-300' };
    return { label: 'EVENT', icon: Calendar, cls: 'bg-emerald-500/20 text-emerald-300' };
  };

  // TIME-BASED MODE LOGIC
  const currentHour = now ? now.getHours() : 12;
  const isMorning = currentHour >= 6 && currentHour < 9;
  const isDeepWork = currentHour >= 9 && currentHour < 17;
  const isEvening = currentHour >= 20 || currentHour < 6;

  // DYNAMIC LAYOUT CLASSES
  const bgTheme = isEvening ? 'bg-[#030508] text-neutral-400' : 'bg-[#070B14] text-white';
  const leftColSpan = isDeepWork ? 'col-span-3' : 'col-span-4'; // Shrinks Oura during work
  const rightColSpan = isDeepWork ? 'col-span-9' : 'col-span-8'; // Expands schedule during work

  // FILTER REMINDERS (TODAY)
  const todayDateStr = now ? now.toLocaleDateString('en-CA') : '';
  const todayReminders = (data.reminders || [])
    .filter((i: any) => i.dueDate && new Date(i.dueDate).toLocaleDateString('en-CA') === todayDateStr)
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // MODAL OVERLAY RENDERER
  const renderModal = () => {
    if (!activeModal) return null;
    return (
      <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-12">
        <div className="bg-[#0c1222] border border-white/10 rounded-3xl w-full h-full p-8 flex flex-col relative shadow-2xl">
          <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white">
            <X className="w-8 h-8" />
          </button>
          
          {activeModal === 'reminders' && (
            <div className="flex flex-col h-full">
              <h2 className="text-4xl font-bold text-white mb-6">All Open Tasks (Master List)</h2>
              <div className="grid grid-cols-3 gap-4 overflow-y-auto">
                {data.reminders.map((r: any, i: number) => (
                  <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="font-bold text-lg truncate">{r.title}</div>
                    <div className="text-sm text-sky-400 mt-1">{r.list || 'General'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeModal === 'calendar' && (
            <div className="flex flex-col h-full">
              <h2 className="text-4xl font-bold text-white mb-6">Expanded Calendar</h2>
              <div className="grid grid-cols-2 gap-4 overflow-y-auto">
                {data.events.slice(0, 20).map((e: any, i: number) => (
                  <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between">
                    <span className="font-bold">{e.summary}</span>
                    <span className="text-neutral-400 font-mono">{new Date(e.start).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModal === 'oura' && (
            <div className="flex flex-col h-full items-center justify-center">
              <Activity className="w-24 h-24 text-emerald-400 mb-6" />
              <h2 className="text-4xl font-bold text-white mb-4">Detailed Biometrics</h2>
              <p className="text-xl text-neutral-400">Readiness: {data.oura.readiness} | Sleep: {data.oura.sleep} | Stress: {data.oura.stress}m</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className={`h-screen w-screen overflow-hidden p-6 flex flex-col justify-between gap-5 select-none font-sans transition-colors duration-1000 ${bgTheme}`}>
      {renderModal()}
      
      {/* HEADER */}
      <header className={`grid grid-cols-12 gap-4 pb-4 border-b border-white/10 ${isEvening ? 'opacity-70' : 'opacity-100'}`}>
        <div className="col-span-3 flex flex-col justify-center">
          <div className="text-7xl font-black">{now ? now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}) : '--:--'}</div>
          <div className="text-base font-bold text-neutral-400 uppercase mt-2">{now ? now.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'short'}) : ''}</div>
        </div>
        
        {/* TIME MODE INDICATOR */}
        <div className="col-span-4 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isMorning ? 'bg-amber-500/20 text-amber-400' : isDeepWork ? 'bg-indigo-500/20 text-indigo-400' : 'bg-purple-500/20 text-purple-400'}`}>
             {isMorning ? <Sun className="w-6 h-6" /> : isDeepWork ? <BookOpen className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase">{isMorning ? 'Morning Mode' : isDeepWork ? 'Deep Work Mode' : 'Evening Wind-Down'}</div>
            <div className="text-xl font-bold">{data.events[0]?.summary || 'Clear Schedule'}</div>
          </div>
        </div>
        
        {/* WEATHER / ENV */}
        <div className="col-span-5 flex justify-end">
           <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-4">
             <Sun className="w-8 h-8 text-amber-400" />
             <div>
               <div className="text-3xl font-extrabold">{data.weather?.temp}°C</div>
               <div className="text-xs font-bold text-neutral-400 uppercase mt-1">AQI: {data.weather?.aqi}</div>
             </div>
           </div>
        </div>
      </header>

      {/* BODY GRID */}
      <div className={`grid grid-cols-12 gap-5 flex-1 min-h-0 ${isEvening ? 'opacity-80' : 'opacity-100'}`}>
        
        {/* LEFT COLUMN: OURA */}
        <div className={`${leftColSpan} flex flex-col gap-5 min-h-0 transition-all duration-700`}>
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex flex-col justify-between shrink-0">
            <span className="font-bold text-sm text-neutral-300 uppercase mb-4 flex justify-between">Biometrics <Activity className="w-5 h-5 text-emerald-400"/></span>
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-black/40 p-4 rounded-2xl flex justify-between"><span className="text-sm font-bold text-neutral-400">R</span> <span className="text-3xl font-bold text-amber-400">{data.oura?.readiness}</span></div>
               <div className="bg-black/40 p-4 rounded-2xl flex justify-between"><span className="text-sm font-bold text-neutral-400">S</span> <span className="text-3xl font-bold text-indigo-400">{data.oura?.sleep}</span></div>
            </div>
          </div>
          
          {/* Hide trend graphs during Deep Work to free visual space */}
          {!isDeepWork && (
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex-1 flex items-center justify-center text-neutral-500">
               [ 7-Day Trend Graph Area ]
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SCHEDULE & TASKS */}
        <div className={`${rightColSpan} flex flex-col gap-5 min-h-0 transition-all duration-700`}>
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex-1 flex flex-col min-h-0">
             <span className="font-bold text-sm text-neutral-300 uppercase mb-3 flex justify-between">Schedule <Calendar className="w-5 h-5 text-sky-400"/></span>
             <div className="flex-1 overflow-auto space-y-2">
               {data.events.slice(0, isDeepWork ? 8 : 4).map((ev:any, i:number) => (
                 <div key={i} className="bg-black/40 p-3 rounded-xl flex justify-between items-center border border-white/5">
                   <span className="font-bold">{ev.summary}</span>
                   <span className="text-neutral-400 font-mono">{new Date(ev.start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
                 </div>
               ))}
             </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 flex-1 flex flex-col min-h-0">
             <span className="font-bold text-sm text-neutral-300 uppercase mb-3 flex justify-between">Today's Tasks <CheckCircle2 className="w-5 h-5 text-sky-400"/></span>
             <div className="grid grid-cols-2 gap-2 content-start flex-1 overflow-auto">
               {todayReminders.map((r:any, i:number) => (
                 <div key={i} className="bg-black/40 p-2.5 rounded-xl border border-white/5 truncate text-sm font-bold">
                   <span className="w-2 h-2 inline-block rounded-full bg-sky-400 mr-2"></span>{r.title}
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </main>
  );
}

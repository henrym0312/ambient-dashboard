'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  Calendar,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Umbrella,
  GraduationCap,
  MapPin,
  Users,
  BookOpen,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Coins,
  TrendingUp,
  TrendingDown,
  Battery,
  Footprints,
  Pill,
  Sparkles,
  Music,
  Fan,
  Lightbulb,
  Laptop,
  Smartphone,
  Keyboard,
  Mouse,
  Headphones,
  type LucideIcon,
} from 'lucide-react';
import {
  MedLogPayload,
  computePKStats,
  generateDayCurve,
} from '@/lib/meds';
import type { BatteryFleetData } from '@/app/api/battery/route';

const TZ = 'Europe/London';

interface WeatherData {
  temp: number | string;
  precipitation: number;
  aqi: number | string;
  weatherCode?: number;
  isDay?: number;
}

interface GoldData {
  paxgUsdt: number;
  gbpUsdt: number;
  gramPriceGbp: number;
  currentValue: number;
  purchasePrice: number;
  profitGbp: number;
  profitPct: number;
  isProfit: boolean;
}

interface OuraHistoryItem {
  day: string;
  label: string;
  sleep: number;
  readiness: number;
  hours: number;
  formattedTime?: string;
}

interface OuraData {
  readiness: number | string;
  sleep: number | string;
  steps: number | string;
  stress: string;
  battery?: number | null;
  history: OuraHistoryItem[];
}

interface CalendarEvent {
  summary: string;
  start: string;
  end?: string;
  location?: string;
  calendar?: 'Main' | 'Uni' | string;
  isFullDay?: boolean;
}

interface ReminderListObject {
  title?: string;
  name?: string;
}

interface ReminderItem {
  id?: string;
  title?: string;
  text?: string;
  dueDate?: string | null;
  hasTime?: boolean;
  priority?: number;
  flagged?: boolean;
  list?: string | ReminderListObject;
  listName?: string;
  notes?: string;
}

interface EmailBox {
  unread: number;
  total: number;
}

interface EmailsData {
  gmail: EmailBox;
  uni: EmailBox;
}

interface TuyaState {
  fan: boolean | null;
  lamp: boolean | null;
  error?: string | null;
  updatedAt?: string;
}

interface DashboardState {
  weather: WeatherData;
  oura: OuraData;
  events: CalendarEvent[];
  news: string[];
  reminders: ReminderItem[];
  emails: EmailsData;
  gold: GoldData;
  meds: MedLogPayload;
  tuya?: TuyaState;
  battery?: BatteryFleetData | null;
  updatedAt?: string;
}

const GlassCard = React.memo(
  ({
    children,
    className = '',
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <div
      onClick={onClick}
      className={`bg-white/[0.035] border border-white/[0.09] shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] rounded-3xl p-6 ${
        onClick ? 'cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.14]' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
);
GlassCard.displayName = 'GlassCard';

const UpcomingEventModal = ({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) => {
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
    const initTimeout = setTimeout(updateTimer, 0);
    const timer = setInterval(updateTimer, 1000);
    return () => {
      clearTimeout(initTimeout);
      clearInterval(timer);
    };
  }, [event]);

  return (
    <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-10 animate-in fade-in zoom-in duration-300">
      <div className="w-full h-full bg-black border border-white/15 rounded-3xl flex flex-col items-center justify-center relative p-8 shadow-[0_0_50px_rgba(255,255,255,0.03)] text-center">
        <button
          onClick={onClose}
          className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="w-24 h-24 rounded-full bg-sky-500/20 flex items-center justify-center mb-8 animate-pulse">
          <Calendar className="w-12 h-12 text-sky-400" />
        </div>
        <h2 className="text-2xl font-medium text-white/50 uppercase tracking-widest mb-4">
          Starting Soon
        </h2>
        <h1 className="text-6xl font-semibold text-white mb-4 max-w-4xl truncate">
          {event.summary}
        </h1>
        {event.location && (
          <div className="flex items-center gap-2 text-xl text-white/60 mb-8">
            <MapPin className="w-5 h-5 text-sky-400" />
            <span>{event.location}</span>
          </div>
        )}
        <div className="text-[120px] leading-none font-light text-sky-400 font-mono tabular-nums tracking-tighter">
          {timeLeft}
        </div>
      </div>
    </div>
  );
};

function getTempColor(temp: number | string): string {
  const num = typeof temp === 'number' ? temp : parseFloat(String(temp));
  if (isNaN(num)) return 'text-white/95';
  if (num <= 0) return 'text-sky-300';
  if (num <= 7) return 'text-cyan-400';
  if (num <= 14) return 'text-teal-300';
  if (num <= 20) return 'text-emerald-300';
  if (num <= 26) return 'text-amber-300';
  if (num <= 31) return 'text-orange-400';
  return 'text-rose-400';
}

function getWeatherIcon(
  code: number = 0,
  isDay: number = 1
): { Icon: LucideIcon; color: string; glow: string } {
  if (code >= 95) {
    return {
      Icon: CloudLightning,
      color: 'text-amber-400',
      glow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]',
    };
  }
  if (code >= 71 && code <= 86) {
    return {
      Icon: CloudSnow,
      color: 'text-sky-200',
      glow: 'drop-shadow-[0_0_8px_rgba(186,230,253,0.6)]',
    };
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return {
      Icon: CloudRain,
      color: 'text-sky-400',
      glow: 'drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]',
    };
  }
  if (code >= 45 && code <= 48) {
    return { Icon: Cloud, color: 'text-slate-300', glow: '' };
  }
  if (code >= 1 && code <= 44) {
    return { Icon: Cloud, color: 'text-zinc-300', glow: '' };
  }
  if (isDay === 0) {
    return {
      Icon: Moon,
      color: 'text-indigo-300',
      glow: 'drop-shadow-[0_0_10px_rgba(165,180,252,0.4)]',
    };
  }
  return {
    Icon: Sun,
    color: 'text-amber-400',
    glow: 'drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]',
  };
}

function getBiometricScoreColor(score: number | string | undefined | null): { text: string; dot: string; bg: string; border: string } {
  const num = typeof score === 'number' ? score : Number(score);
  if (isNaN(num) || score === undefined || score === null || score === '--') {
    return { text: 'text-white/60', dot: 'bg-white/20', bg: 'bg-white/[0.04]', border: 'border-white/10' };
  }
  // User condition: 0-60: Red; 61-79: Yellow; 80-100: Green
  if (num >= 80) {
    return { text: 'text-emerald-400', dot: 'bg-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' };
  }
  if (num >= 61) {
    return { text: 'text-amber-400', dot: 'bg-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' };
  }
  return { text: 'text-rose-400', dot: 'bg-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' };
}

function getScoreDotColor(score: number | string): string {
  return getBiometricScoreColor(score).dot;
}

function getSleepTrendDurationColor(hours: number): { hex: string; text: string; bg: string; border: string } {
  // User condition: 0-5hrs: Red; 5-7: Yellow; 7+: Green
  if (hours >= 7) {
    return { hex: '#34d399', text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' };
  }
  if (hours >= 5) {
    return { hex: '#fbbf24', text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' };
  }
  return { hex: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' };
}

function getDeviceBatteryColor(percent: number | null | undefined): { text: string } {
  if (percent === null || percent === undefined || isNaN(percent)) {
    return { text: 'text-white/70' };
  }
  // User condition: 0-30: Red; 31-60: yellow; 61+: Green
  if (percent >= 61) {
    return { text: 'text-emerald-400 font-normal' };
  }
  if (percent >= 31) {
    return { text: 'text-amber-400 font-normal' };
  }
  return { text: 'text-rose-400 font-normal' };
}

function getOuraBatteryColor(battery: number | null | undefined): { text: string; bg: string; border: string; icon: string } {
  if (battery === null || battery === undefined || isNaN(battery)) {
    return { text: 'text-white/50', bg: 'bg-white/[0.04]', border: 'border-white/10', icon: 'text-white/40' };
  }
  // User condition: 0-39: Red; 40-80: Green; 80-100: Red
  if (battery >= 40 && battery <= 80) {
    return { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: 'text-emerald-400' };
  }
  return { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30', icon: 'text-rose-400' };
}

function isAcademicEvent(summary: string = ''): boolean {
  const s = summary.toLowerCase();
  if (s.includes('walk') || s.includes('->') || s.includes('transit') || s.includes('transport')) {
    return false;
  }
  return s.includes('lecture') || s.includes('seminar') || s.includes('tutorial');
}

function formatSleepDuration(hours: number, formattedTime?: string): string {
  if (formattedTime && formattedTime !== '--') return formattedTime;
  if (!hours || hours <= 0) return '--';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getSmoothCurvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function AmbientDashboard() {
  const [now, setNow] = useState<Date | null>(null);
  const [manualModal, setManualModal] = useState<'calendar' | 'reminders' | 'oura' | 'meds' | null>(null);
  const [dismissedEventKey, setDismissedEventKey] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState(false);

  const [data, setData] = useState<DashboardState>({
    weather: { temp: '--', precipitation: 0, aqi: '--', weatherCode: 0, isDay: 1 },
    oura: { readiness: '--', sleep: '--', steps: '--', stress: '--', battery: null, history: [] },
    events: [],
    news: [],
    reminders: [],
    emails: { gmail: { unread: 0, total: 0 }, uni: { unread: 0, total: 0 } },
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
    meds: { date: '', taken: {} },
    tuya: { fan: null, lamp: null },
    battery: null,
  });

  useEffect(() => {
    const initTimer = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, remRes, emailRes, medRes, batRes] = await Promise.allSettled([
          fetch('/api/dashboard', { cache: 'no-store' }),
          fetch('/api/reminders', { cache: 'no-store' }),
          fetch('/api/emails', { cache: 'no-store' }),
          fetch('/api/meds', { cache: 'no-store' }),
          fetch('/api/battery', { cache: 'no-store' }),
        ]);

        let anySuccess = false;
        const updates: Partial<DashboardState> = {};

        if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
          const dashJson = (await dashRes.value.json()) as Partial<DashboardState>;
          if (dashJson.weather && dashJson.weather.temp !== '--') {
            updates.weather = dashJson.weather;
          }
          if (dashJson.oura) {
            updates.oura = dashJson.oura;
          }
          if (Array.isArray(dashJson.events)) {
            updates.events = dashJson.events;
          }
          if (Array.isArray(dashJson.news) && dashJson.news.length > 0) {
            updates.news = dashJson.news;
          }
          if (dashJson.gold) {
            updates.gold = dashJson.gold;
          }
          if (dashJson.tuya) {
            updates.tuya = dashJson.tuya;
          }
          if (dashJson.updatedAt) {
            updates.updatedAt = dashJson.updatedAt;
          }
          anySuccess = true;
        }

        if (remRes.status === 'fulfilled' && remRes.value.ok) {
          const remJson = await remRes.value.json();
          const parsedReminders = Array.isArray(remJson)
            ? remJson
            : Array.isArray(remJson?.items)
              ? remJson.items
              : null;
          if (parsedReminders) {
            updates.reminders = parsedReminders;
            anySuccess = true;
          }
        }

        if (emailRes.status === 'fulfilled' && emailRes.value.ok) {
          const emailJson = (await emailRes.value.json()) as EmailsData;
          if (emailJson?.gmail && emailJson?.uni) {
            updates.emails = emailJson;
            anySuccess = true;
          }
        }

        if (medRes.status === 'fulfilled' && medRes.value.ok) {
          const medJson = (await medRes.value.json()) as MedLogPayload;
          if (medJson && medJson.taken) {
            updates.meds = medJson;
            anySuccess = true;
          }
        }

        if (batRes.status === 'fulfilled' && batRes.value.ok) {
          const batJson = (await batRes.value.json()) as BatteryFleetData;
          if (batJson) {
            updates.battery = batJson;
            anySuccess = true;
          }
        }

        if (anySuccess) {
          setData((prev) => ({
            ...prev,
            ...updates,
            oura:
              updates.oura &&
              (updates.oura.readiness !== '--' || prev.oura.readiness === '--')
                ? updates.oura
                : prev.oura,
          }));
          setLastSyncedAt(new Date());
          setSyncError(false);
        } else {
          setSyncError(true);
        }
      } catch (e) {
        console.error('Dashboard poll failed:', e);
        setSyncError(true);
      }
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, []);

  const nextEvent = data.events && data.events.length > 0 ? data.events[0] : null;

  // Find the next upcoming event that hasn't started yet for the 15-minute alert modal
  const upcomingAlertEvent = useMemo(() => {
    if (!now || !data.events) return null;
    const nowMs = now.getTime();
    for (const ev of data.events) {
      const timeTo = new Date(ev.start).getTime() - nowMs;
      if (timeTo > 0 && timeTo <= 15 * 60 * 1000) {
        return ev;
      }
    }
    return null;
  }, [now, data.events]);

  const upcomingEventKey = upcomingAlertEvent
    ? `${upcomingAlertEvent.summary}${upcomingAlertEvent.start}`
    : null;

  const isUpcomingModalOpen = Boolean(
    upcomingAlertEvent && upcomingEventKey && dismissedEventKey !== upcomingEventKey
  );

  const activeModal: 'calendar' | 'reminders' | 'oura' | 'meds' | 'upcoming' | null =
    manualModal ?? (isUpcomingModalOpen ? 'upcoming' : null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Fire Stick D-Pad & Keyboard navigation:
      // UP    -> ADHD Medication Protocol
      // DOWN  -> Tasks & Reminders
      // LEFT  -> Oura Biometrics & Sleep
      // RIGHT -> Calendar Schedule
      if (e.key === 'ArrowUp' || e.key === 'm' || e.key === 'M') {
        setManualModal((prev) => (prev === 'meds' ? null : 'meds'));
      } else if (e.key === 'ArrowDown' || e.key === 'r' || e.key === 'R') {
        setManualModal((prev) => (prev === 'reminders' ? null : 'reminders'));
      } else if (e.key === 'ArrowLeft' || e.key === 'o' || e.key === 'O') {
        setManualModal((prev) => (prev === 'oura' ? null : 'oura'));
      } else if (e.key === 'ArrowRight' || e.key === 'c' || e.key === 'C') {
        setManualModal((prev) => (prev === 'calendar' ? null : 'calendar'));
      } else if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Backspace') {
        if (isUpcomingModalOpen && upcomingEventKey) {
          setDismissedEventKey(upcomingEventKey);
        }
        setManualModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUpcomingModalOpen, upcomingEventKey]);

  const getRelativeTime = (startStr: string, endStr?: string) => {
    if (!now) return '';
    const nowMs = now.getTime();
    const startMs = new Date(startStr).getTime();
    const endMs = endStr ? new Date(endStr).getTime() : startMs;

    if (startMs <= nowMs && endMs > nowMs) {
      const remMins = Math.max(1, Math.ceil((endMs - nowMs) / 60000));
      if (remMins < 60) return `${remMins}m remaining`;
      return `${Math.floor(remMins / 60)}h ${remMins % 60}m left`;
    }

    const diff = startMs - nowMs;
    if (diff <= 0) return 'Now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
    return `in ${Math.floor(hrs / 24)}d`;
  };

  const getEventBadge = (
    summary: string = ''
  ): { label: string; icon: LucideIcon; color: string; dot: string } => {
    const s = summary.toLowerCase();
    if (s.includes('walk') || s.includes('->') || s.includes('transit') || s.includes('transport')) {
      return { label: 'Transport', icon: MapPin, color: 'text-neutral-300', dot: 'bg-neutral-400' };
    }
    if (s.includes('lecture')) {
      return {
        label: 'Lecture',
        icon: GraduationCap,
        color: 'text-purple-300',
        dot: 'bg-purple-400',
      };
    }
    if (s.includes('seminar')) {
      return { label: 'Seminar', icon: Users, color: 'text-indigo-300', dot: 'bg-indigo-400' };
    }
    if (s.includes('tutorial')) {
      return { label: 'Tutorial', icon: BookOpen, color: 'text-sky-300', dot: 'bg-sky-400' };
    }
    return { label: 'Event', icon: Calendar, color: 'text-emerald-300', dot: 'bg-emerald-400' };
  };

  const getReminderListStyle = (rawList: string | ReminderListObject = '') => {
    const l = (
      typeof rawList === 'string' ? rawList : rawList?.title || rawList?.name || 'General'
    )
      .trim()
      .toLowerCase();
    if (l.includes('household')) {
      return { name: 'Household', color: 'text-amber-400', border: 'border-amber-400', dot: 'bg-amber-400' };
    }
    if (l.includes('health')) {
      return { name: 'Health', color: 'text-red-400', border: 'border-red-400', dot: 'bg-red-400' };
    }
    if (l.includes('finance')) {
      return { name: 'Finances', color: 'text-emerald-400', border: 'border-emerald-400', dot: 'bg-emerald-400' };
    }
    if (l.includes('work')) {
      return { name: 'Work', color: 'text-neutral-300', border: 'border-neutral-400', dot: 'bg-neutral-400' };
    }
    if (l.includes('shopping')) {
      return { name: 'Shopping', color: 'text-sky-400', border: 'border-sky-400', dot: 'bg-sky-400' };
    }
    if (l.includes('uni')) {
      return { name: 'Uni', color: 'text-purple-400', border: 'border-purple-400', dot: 'bg-purple-400' };
    }
    if (l.includes('duglj')) {
      return { name: 'DUGLJ', color: 'text-blue-400', border: 'border-blue-500', dot: 'bg-blue-500' };
    }
    if (l.includes('exam')) {
      return { name: 'Exams', color: 'text-red-500', border: 'border-red-500', dot: 'bg-red-500' };
    }
    return {
      name: l || 'Task',
      color: 'text-neutral-300',
      border: 'border-neutral-500',
      dot: 'bg-neutral-500',
    };
  };

  const timeString = now
    ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
    : '--:--';
  const dateString = now
    ? now.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: TZ,
      })
    : 'Loading...';
  const stepsFormatted =
    typeof data.oura?.steps === 'number'
      ? data.oura.steps.toLocaleString('en-GB')
      : data.oura?.steps ?? '--';

  const todayIso = now ? now.toLocaleDateString('en-CA', { timeZone: TZ }) : '';

  const groupedEvents: Record<string, { dateLabel: string; isToday: boolean; items: CalendarEvent[] }> =
    {};
  if (now && data.events) {
    data.events.slice(0, 4).forEach((ev) => {
      const evDate = new Date(ev.start);
      const iso = evDate.toLocaleDateString('en-CA', { timeZone: TZ });
      const formattedDate =
        iso === todayIso
          ? 'Today'
          : evDate.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              timeZone: TZ,
            });
      if (!groupedEvents[iso]) {
        groupedEvents[iso] = { dateLabel: formattedDate, isToday: iso === todayIso, items: [] };
      }
      groupedEvents[iso].items.push(ev);
    });
  }

  const currentHour = now ? now.getHours() : 12;
  const currentMinute = now ? now.getMinutes() : 0;
  const isDeepWork = currentHour >= 9 && currentHour < 17;
  const isEvening = currentHour >= 20 || currentHour < 6;
  const isDeepSleep = (currentHour === 23 && currentMinute >= 30) || currentHour < 6;

  // Subtle orbital pixel shift (±3px X, ±2px Y) to prevent 24/7 static burn-in
  const pixelShift = useMemo(() => {
    if (!now) return { x: 0, y: 0 };
    const minuteTick = Math.floor(now.getTime() / 60000);
    const angle = (minuteTick % 12) * ((2 * Math.PI) / 12);
    return {
      x: Math.round(Math.sin(angle) * 3),
      y: Math.round(Math.cos(angle * 2) * 2),
    };
  }, [now]);

  const leftColSpan = isDeepWork ? 'col-span-3' : 'col-span-4';
  const rightColSpan = isDeepWork ? 'col-span-9' : 'col-span-8';

  const getReminderDueMeta = useMemo(() => {
    const tomorrowIso = now
      ? new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: TZ })
      : '';

    return (item: ReminderItem) => {
      if (!item.dueDate || !todayIso) {
        return {
          bucket: 'undated' as const,
          label: item.flagged || (item.priority && item.priority <= 4) ? 'Priority' : null,
          isOverdue: false,
          isToday: false,
        };
      }
      const d = new Date(item.dueDate);
      if (isNaN(d.getTime())) {
        return { bucket: 'undated' as const, label: null, isOverdue: false, isToday: false };
      }
      const itemIso = d.toLocaleDateString('en-CA', { timeZone: TZ });
      const showTime =
        item.hasTime !== undefined
          ? item.hasTime
          : d.getHours() !== 0 || d.getMinutes() !== 0;
      const timeStr = showTime
        ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
        : null;

      if (itemIso < todayIso) {
        return {
          bucket: 'overdue' as const,
          label: 'Overdue',
          isOverdue: true,
          isToday: false,
        };
      }
      if (itemIso === todayIso) {
        return {
          bucket: 'today' as const,
          label: timeStr || 'Today',
          isOverdue: false,
          isToday: true,
        };
      }
      if (itemIso === tomorrowIso) {
        return {
          bucket: 'upcoming' as const,
          label: timeStr ? `Tmrw ${timeStr}` : 'Tomorrow',
          isOverdue: false,
          isToday: false,
        };
      }
      const shortDate = d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: TZ,
      });
      return {
        bucket: 'upcoming' as const,
        label: shortDate,
        isOverdue: false,
        isToday: false,
      };
    };
  }, [now, todayIso]);

  const todayReminders = useMemo(() => {
    const all = data.reminders || [];
    if (all.length === 0) return [];

    const scored = all.map((item) => {
      const meta = getReminderDueMeta(item);
      const bucketWeight =
        meta.bucket === 'overdue'
          ? 0
          : meta.bucket === 'today'
            ? 1
            : item.flagged || (item.priority && item.priority > 0 && item.priority <= 4)
              ? 2
              : meta.bucket === 'undated'
                ? 3
                : 4;
      const dueMs = item.dueDate ? new Date(item.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return { item, meta, bucketWeight, dueMs };
    });

    scored.sort((a, b) => {
      if (a.bucketWeight !== b.bucketWeight) return a.bucketWeight - b.bucketWeight;
      if (a.dueMs !== b.dueMs) return a.dueMs - b.dueMs;
      return (a.item.title || a.item.text || '').localeCompare(b.item.title || b.item.text || '');
    });

    // Equal 2-column layout showing up to 8 tasks (4 per column) with zero scrolling or cutoffs
    return scored.slice(0, 8).map((s) => s.item);
  }, [data.reminders, getReminderDueMeta]);

  // Total active reminders due today (or overdue from earlier)
  const remindersLeftToday = useMemo(() => {
    const all = data.reminders || [];
    if (!todayIso || all.length === 0) return 0;
    return all.filter((r) => {
      const meta = getReminderDueMeta(r);
      return meta.isToday || meta.isOverdue;
    }).length;
  }, [data.reminders, getReminderDueMeta, todayIso]);

  // Total events remaining today (start or end is in the future)
  const eventsLeftToday = useMemo(() => {
    if (!now || !data.events || data.events.length === 0) return 0;
    const nowMs = now.getTime();
    return data.events.filter((ev) => {
      const evDate = new Date(ev.start);
      const iso = evDate.toLocaleDateString('en-CA', { timeZone: TZ });
      if (iso !== todayIso) return false;
      const endMs = ev.end ? new Date(ev.end).getTime() : new Date(ev.start).getTime() + 3600000;
      return endMs > nowMs;
    }).length;
  }, [now, data.events, todayIso]);

  const sleepStats = useMemo(() => {
    const hist = data.oura?.history || [];
    const validHours = hist.map((d) => d.hours).filter((h) => h > 0);
    const validScores = hist.map((d) => d.sleep).filter((s) => s > 0);
    const avgHours =
      validHours.length > 0
        ? (validHours.reduce((acc, h) => acc + h, 0) / validHours.length).toFixed(1)
        : null;
    const avgScore =
      validScores.length > 0
        ? Math.round(validScores.reduce((acc, s) => acc + s, 0) / validScores.length)
        : null;
    return { avgHours, avgScore };
  }, [data.oura?.history]);

  // Generate smooth SVG line telemetry curve and coordinates for 7-day sleep (main view)
  const sleepGraphData = useMemo(() => {
    const hist = data.oura?.history || [];
    if (hist.length === 0) return null;

    const points = hist.map((d, i) => {
      const x = 28 + i * 54; // 28, 82, 136, 190, 244, 298, 352 (width 380)
      const clampHours = Math.max(3.5, Math.min(9.5, d.hours || 3.5));
      const y = 98 - ((clampHours - 3.5) / 6.0) * 62;
      const timeStr = formatSleepDuration(d.hours, d.formattedTime);
      return {
        x,
        y: Number(y.toFixed(1)),
        hours: d.hours,
        timeStr,
        label: d.label.slice(0, 2),
        isLatest: i === hist.length - 1,
      };
    });

    const curveD = getSmoothCurvePath(points);
    const areaD =
      points.length > 0
        ? `${curveD} L ${points[points.length - 1].x} 110 L ${points[0].x} 110 Z`
        : '';

    return { points, curveD, areaD };
  }, [data.oura?.history]);

  // Pharmacokinetic stats and plasma simulation for ADHD medications
  const pkStats = useMemo(() => {
    if (!now) return null;
    return computePKStats(now, data.meds?.taken);
  }, [now, data.meds?.taken]);

  const pkCurve = useMemo(() => {
    if (!now) return null;
    return generateDayCurve(now, data.meds?.taken);
  }, [now, data.meds?.taken]);

  // Sparkline coordinates for main medication card (enlarged to fill card)
  const medSparkline = useMemo(() => {
    if (!pkCurve || pkCurve.points.length === 0) return null;
    const width = 360;
    const height = 100;
    const padLeft = 8;
    const padRight = 8;
    const padTop = 14;
    const padBottom = 16;
    const graphW = width - padLeft - padRight;
    const graphH = height - padTop - padBottom;
    const totalHours = Math.max(4, pkCurve.endHour - pkCurve.startHour);
    const maxC = Math.max(15, pkCurve.maxConc * 1.15);

    const pts = pkCurve.points.map((p) => {
      const x = padLeft + ((p.hour - pkCurve.startHour) / totalHours) * graphW;
      const y = padTop + graphH - (p.conc / maxC) * graphH;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    const curveD = getSmoothCurvePath(pts);
    const areaD =
      pts.length > 0
        ? `${curveD} L ${pts[pts.length - 1].x} ${padTop + graphH} L ${pts[0].x} ${padTop + graphH} Z`
        : '';

    let nowX = null;
    let nowY = null;
    if (pkCurve.currentHourDec >= pkCurve.startHour && pkCurve.currentHourDec <= pkCurve.endHour) {
      nowX = Number(
        (padLeft + ((pkCurve.currentHourDec - pkCurve.startHour) / totalHours) * graphW).toFixed(1)
      );
      nowY = Number((padTop + graphH - (pkCurve.nowConc / maxC) * graphH).toFixed(1));
    }

    // Grid markers for [8, 12, 16, 20]
    const gridHours = [8, 12, 16, 20]
      .filter((h) => h > pkCurve.startHour && h < pkCurve.endHour)
      .map((gh) => ({
        hour: gh,
        x: Number((padLeft + ((gh - pkCurve.startHour) / totalHours) * graphW).toFixed(1)),
      }));

    return { curveD, areaD, nowX, nowY, nowConc: pkCurve.nowConc, gridHours, padTop, graphH };
  }, [pkCurve]);

  // Large modal concentration graph coordinates (width 920, height 210)
  const modalMedGraph = useMemo(() => {
    if (!pkCurve || pkCurve.points.length === 0) return null;
    const width = 920;
    const height = 210;
    const padLeft = 40;
    const padRight = 40;
    const padTop = 20;
    const padBottom = 30;
    const graphW = width - padLeft - padRight;
    const graphH = height - padTop - padBottom;
    const totalHours = Math.max(4, pkCurve.endHour - pkCurve.startHour);
    const maxC = Math.max(15, pkCurve.maxConc * 1.15);

    const pts = pkCurve.points.map((p) => {
      const x = padLeft + ((p.hour - pkCurve.startHour) / totalHours) * graphW;
      const y = padTop + graphH - (p.conc / maxC) * graphH;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    const curveD = getSmoothCurvePath(pts);
    const areaD =
      pts.length > 0
        ? `${curveD} L ${pts[pts.length - 1].x} ${padTop + graphH} L ${pts[0].x} ${padTop + graphH} Z`
        : '';

    let nowX = null;
    let nowY = null;
    if (pkCurve.currentHourDec >= pkCurve.startHour && pkCurve.currentHourDec <= pkCurve.endHour) {
      nowX = Number(
        (padLeft + ((pkCurve.currentHourDec - pkCurve.startHour) / totalHours) * graphW).toFixed(1)
      );
      nowY = Number((padTop + graphH - (pkCurve.nowConc / maxC) * graphH).toFixed(1));
    }

    const gridHours = [6, 8, 10, 12, 14, 16, 18, 20, 22]
      .filter((h) => h >= pkCurve.startHour && h <= pkCurve.endHour)
      .map((gh) => ({
        hour: gh,
        x: Number((padLeft + ((gh - pkCurve.startHour) / totalHours) * graphW).toFixed(1)),
      }));

    return { curveD, areaD, nowX, nowY, gridHours, padTop, graphH, padLeft, graphW, maxC };
  }, [pkCurve]);

  // Large high-resolution sleep telemetry graph for the expanded Oura modal
  const modalSleepGraphData = useMemo(() => {
    const hist = data.oura?.history || [];
    if (hist.length === 0) return null;

    const points = hist.map((d, i) => {
      const x = 70 + i * 130; // 70, 200, 330, 460, 590, 720, 850 (width 920)
      const clampHours = Math.max(3.5, Math.min(9.5, d.hours || 3.5));
      const y = 145 - ((clampHours - 3.5) / 6.0) * 95; // range from 50 to 145
      const timeStr = formatSleepDuration(d.hours, d.formattedTime);
      return {
        x,
        y: Number(y.toFixed(1)),
        hours: d.hours,
        timeStr,
        label: d.label,
        sleepScore: d.sleep,
        isLatest: i === hist.length - 1,
      };
    });

    const curveD = getSmoothCurvePath(points);
    const areaD =
      points.length > 0
        ? `${curveD} L ${points[points.length - 1].x} 165 L ${points[0].x} 165 Z`
        : '';

    return { points, curveD, areaD };
  }, [data.oura?.history]);

  // Check if nextEvent is currently active and calculate progress
  const nextEventStatus = useMemo(() => {
    if (!now || !nextEvent) {
      return { isActive: false, progressPct: 0, isSoon: false };
    }
    const nowMs = now.getTime();
    const startMs = new Date(nextEvent.start).getTime();
    const endMs = nextEvent.end ? new Date(nextEvent.end).getTime() : startMs + 3600000;
    if (startMs <= nowMs && endMs > nowMs) {
      const total = Math.max(1, endMs - startMs);
      const pct = Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / total) * 100)));
      return { isActive: true, progressPct: pct, isSoon: false };
    }
    const minsUntil = (startMs - nowMs) / 60000;
    return { isActive: false, progressPct: 0, isSoon: minsUntil > 0 && minsUntil <= 90 };
  }, [now, nextEvent]);

  // Sync freshness status
  const syncAgeMins =
    now && lastSyncedAt ? Math.floor((now.getTime() - lastSyncedAt.getTime()) / 60000) : null;
  const isStale = syncError || (syncAgeMins !== null && syncAgeMins >= 15);

  const {
    Icon: WeatherIcon,
    color: weatherIconColor,
    glow: weatherIconGlow,
  } = getWeatherIcon(data.weather?.weatherCode, data.weather?.isDay);

  const tempColor = getTempColor(data.weather?.temp);

  const renderModal = () => {
    if (!activeModal) return null;
    if (activeModal === 'upcoming' && upcomingAlertEvent) {
      return (
        <UpcomingEventModal
          event={upcomingAlertEvent}
          onClose={() => {
            if (upcomingEventKey) setDismissedEventKey(upcomingEventKey);
            setManualModal(null);
          }}
        />
      );
    }

    return (
      <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-10 animate-in fade-in duration-200">
        <div className="w-full h-full bg-black border border-white/15 rounded-3xl flex flex-col relative p-8 shadow-[0_0_50px_rgba(255,255,255,0.03)]">
          <button
            onClick={() => setManualModal(null)}
            className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
          >
            <X className="w-6 h-6" />
          </button>

          {activeModal === 'reminders' && (
            <div className="flex flex-col h-full">
              <h2 className="text-4xl font-semibold text-white mb-8">
                All Tasks ({data.reminders.length})
              </h2>
              <div className="overflow-y-auto pr-4 space-y-2.5">
                {data.reminders.map((r, i) => {
                  const listStyle = getReminderListStyle(r.list || r.listName);
                  const dueMeta = getReminderDueMeta(r);
                  return (
                    <div
                      key={r.id || i}
                      className="py-5 px-6 bg-white/[0.04] border border-white/[0.06] rounded-2xl flex items-center gap-5"
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${listStyle.border} bg-transparent shrink-0`}
                      />
                      <div className="font-medium text-xl flex-1 text-white/95 truncate">
                        {r.title || r.text || 'Untitled'}
                      </div>
                      {dueMeta.label && (
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium tabular-nums shrink-0 ${
                            dueMeta.isOverdue
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : dueMeta.isToday
                                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                : 'bg-white/[0.06] text-white/65'
                          }`}
                        >
                          {dueMeta.label}
                        </span>
                      )}
                      <span className={`text-base font-medium capitalize shrink-0 ${listStyle.color}`}>
                        {listStyle.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeModal === 'calendar' && (
            <div className="flex flex-col h-full">
              <h2 className="text-4xl font-semibold text-white mb-8">Calendar Schedule</h2>
              <div className="overflow-y-auto pr-4 space-y-2.5">
                {data.events.map((e, i) => {
                  const badge = getEventBadge(e.summary);
                  const BadgeIcon = badge.icon;
                  return (
                    <div
                      key={i}
                      className="py-5 px-6 bg-white/[0.04] border border-white/[0.06] rounded-2xl flex items-center gap-6"
                    >
                      <div className="flex flex-col min-w-[110px] shrink-0 tabular-nums">
                        <span className="text-white/95 text-lg font-medium">
                          {new Date(e.start).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: TZ,
                          })}
                        </span>
                        <span className="text-white/55 text-sm">
                          {new Date(e.start).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            timeZone: TZ,
                          })}
                        </span>
                      </div>
                      <div className={`w-3 h-3 rounded-full shrink-0 ${badge.dot}`} />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className={`font-medium text-xl truncate ${isAcademicEvent(e.summary) ? 'text-purple-300 font-semibold' : 'text-white/95'}`}>
                          {e.summary}
                        </span>
                        {e.location && (
                          <span className="text-sm text-white/50 truncate">{e.location}</span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white/[0.05] ${badge.color}`}
                      >
                        <BadgeIcon className="w-4 h-4" />
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeModal === 'oura' && (
            <div className="flex flex-col h-full justify-between p-2 max-w-6xl mx-auto w-full">
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <Activity className="w-8 h-8 text-sky-400" />
                  <div>
                    <h2 className="text-3xl font-semibold text-white tracking-tight">
                      Oura Health &amp; Sleep Telemetry
                    </h2>
                    <p className="text-white/50 text-sm">
                      Real-time biometrics &amp; 7-day sleep architecture
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {data.oura?.battery !== undefined && data.oura?.battery !== null && (() => {
                    const ouraCol = getOuraBatteryColor(data.oura.battery);
                    return (
                      <div
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-semibold tabular-nums ${ouraCol.bg} ${ouraCol.border} ${ouraCol.text}`}
                      >
                        <Battery className={`w-4 h-4 ${ouraCol.icon}`} />
                        <span>Ring Battery: {data.oura.battery}%</span>
                      </div>
                    );
                  })()}

                  {sleepStats.avgHours && (() => {
                    const avgCol = getSleepTrendDurationColor(Number(sleepStats.avgHours));
                    return (
                      <div className={`px-3.5 py-1.5 rounded-xl border text-sm font-semibold tabular-nums ${avgCol.bg} ${avgCol.border} ${avgCol.text}`}>
                        7d Avg: {sleepStats.avgHours}h
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 4 CORE METRICS ROW */}
              <div className="grid grid-cols-4 gap-6 my-4 shrink-0 tabular-nums">
                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Readiness Score
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${getScoreDotColor(data.oura.readiness)}`}
                    />
                  </div>
                  <div className={`text-5xl font-light ${getBiometricScoreColor(data.oura.readiness).text}`}>
                    {data.oura.readiness}
                  </div>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Sleep Score
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${getScoreDotColor(data.oura.sleep)}`}
                    />
                  </div>
                  <div className={`text-5xl font-light ${getBiometricScoreColor(data.oura.sleep).text}`}>
                    {data.oura.sleep}
                  </div>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Daily Steps
                    </span>
                    <Footprints className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-5xl font-light text-white">{stepsFormatted}</div>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Daytime Stress
                    </span>
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-5xl font-light text-white">
                    {data.oura.stress}
                    <span className="text-2xl text-white/45 ml-1">m</span>
                  </div>
                </div>
              </div>

              {/* EXPANDED 7-DAY SLEEP TREND GRAPH */}
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 flex flex-col flex-1 min-h-0 relative">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span className="font-semibold text-base text-white/90 uppercase tracking-wider">
                      7-Day Sleep Duration &amp; Architecture
                    </span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-xs text-white/50">Target: 8h 00m</span>
                    {sleepStats.avgScore && (
                      <span className="px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 text-white/70 text-xs font-medium">
                        Avg Score: {sleepStats.avgScore}
                      </span>
                    )}
                  </div>
                </div>

                {/* LARGE SVG GRAPH */}
                <div className="flex-1 min-h-0 flex items-center justify-center relative w-full">
                  {modalSleepGraphData && modalSleepGraphData.points.length > 0 ? (
                    <svg
                      viewBox="0 0 920 200"
                      className="w-full h-full max-h-[220px] overflow-visible select-none"
                    >
                      <defs>
                        <linearGradient id="modalSleepAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.38" />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="modalSleepStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="50%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                      </defs>

                      {/* 8h Target Guideline */}
                      <line
                        x1="40"
                        y1="74"
                        x2="880"
                        y2="74"
                        stroke="rgba(255,255,255,0.15)"
                        strokeDasharray="5 5"
                      />
                      <text
                        x="886"
                        y="78"
                        fill="rgba(255,255,255,0.4)"
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="start"
                        className="font-mono tabular-nums"
                      >
                        8h Target
                      </text>

                      {/* Area Fill */}
                      <path d={modalSleepGraphData.areaD} fill="url(#modalSleepAreaGrad)" />

                      {/* Curve Stroke */}
                      <path
                        d={modalSleepGraphData.curveD}
                        fill="none"
                        stroke="url(#modalSleepStrokeGrad)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Points */}
                      {modalSleepGraphData.points.map((pt, i) => (
                        <g key={i}>
                          {/* Duration label above node: LARGE & CRYSTAL CLEAR */}
                          <text
                            x={pt.x}
                            y={pt.y - 14}
                            textAnchor="middle"
                            fill={pt.isLatest ? '#38bdf8' : '#ffffff'}
                            fontSize="17"
                            fontWeight="700"
                            className="tabular-nums font-mono drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
                          >
                            {pt.timeStr}
                          </text>

                          {/* Pulsing ring for latest / today */}
                          {pt.isLatest && (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="12"
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="2"
                              opacity="0.6"
                              className="animate-pulse"
                            />
                          )}

                          {/* Node Dot */}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={pt.isLatest ? 7 : 5.5}
                            fill={pt.isLatest ? '#38bdf8' : '#818cf8'}
                            stroke="#0b0f19"
                            strokeWidth="3"
                          />

                          {/* Day Label */}
                          <text
                            x={pt.x}
                            y="180"
                            textAnchor="middle"
                            fill={pt.isLatest ? '#38bdf8' : 'rgba(255,255,255,0.7)'}
                            fontSize="15"
                            fontWeight="700"
                            className="uppercase tracking-wider font-sans"
                          >
                            {pt.label}
                          </text>

                          {/* Sleep Score under Day */}
                          {pt.sleepScore > 0 && (
                            <text
                              x={pt.x}
                              y="198"
                              textAnchor="middle"
                              fill={
                                pt.sleepScore >= 80
                                  ? '#34d399'
                                  : pt.sleepScore >= 70
                                    ? '#38bdf8'
                                    : 'rgba(255,255,255,0.5)'
                              }
                              fontSize="12.5"
                              fontWeight="600"
                              className="tabular-nums"
                            >
                              {pt.sleepScore} score
                            </text>
                          )}
                        </g>
                      ))}
                    </svg>
                  ) : (
                    <div className="text-sm text-white/40 m-auto">Syncing sleep telemetry...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeModal === 'meds' && (
            <div className="flex flex-col h-full justify-between p-2 max-w-6xl mx-auto w-full">
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <Pill className="w-8 h-8 text-sky-400" />
                  <div>
                    <h2 className="text-3xl font-semibold text-white tracking-tight">
                      ADHD Medication &amp; Pharmacokinetics
                    </h2>
                    <p className="text-white/50 text-sm">
                      Clinical single-compartment first-order absorption &amp; clearance model
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 text-sm font-semibold tabular-nums">
                    <span>Peak Today: {pkStats?.peakTime || '--:--'}</span>
                    {pkStats && pkStats.peakLevel > 0 && (
                      <span className="opacity-75">({pkStats.peakLevel.toFixed(1)} ng/mL)</span>
                    )}
                  </div>

                  <div className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-white/70 text-sm font-semibold tabular-nums">
                    Est. Clear: {pkStats?.clearTime || '--:--'}
                  </div>
                </div>
              </div>

              {/* 3 CORE SUMMARY CARDS */}
              <div className="grid grid-cols-3 gap-6 my-4 shrink-0 tabular-nums">
                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Serum Concentration
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        (pkStats?.currentLevel ?? 0) > 20
                          ? 'bg-sky-400 animate-pulse'
                          : 'bg-white/20'
                      }`}
                    />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-light text-white">
                      {pkStats?.currentLevel !== undefined
                        ? pkStats.currentLevel.toFixed(1)
                        : '--'}
                    </span>
                    <span className="text-lg text-white/45">ng/mL</span>
                  </div>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Daily Protocol Dosing
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {pkStats?.doses.map((d) => (
                      <div
                        key={d.id}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold border ${
                          d.isTaken
                            ? 'bg-sky-500/15 border-sky-500/35 text-sky-300'
                            : 'bg-white/[0.04] border-white/10 text-white/45'
                        }`}
                      >
                        {d.isTaken ? '✓ ' : ''}
                        {d.name} {d.takeCount > 1 ? `(${d.takeCount}x)` : ''}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                      Elimination Dynamics
                    </span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-sm text-white/70">
                    <div className="flex justify-between py-0.5">
                      <span className="text-white/45">Half-life (t½)</span>
                      <span className="font-mono text-white/90">10.2 hours</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-white/45">Elimination rate (ke)</span>
                      <span className="font-mono text-white/90">0.068 h⁻¹</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LARGE HIGH-DEFINITION PLASMA CONCENTRATION CURVE */}
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 flex flex-col flex-1 min-h-0 relative">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-5 h-5 text-sky-400" />
                    <span className="font-semibold text-base text-white/90 uppercase tracking-wider">
                      24-Hour Plasma Concentration Curve
                    </span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums text-xs text-white/50">
                    <span>Continuous Simulation</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  </div>
                </div>

                {/* GRAPH */}
                <div className="flex-1 min-h-0 flex items-center justify-center relative w-full">
                  {modalMedGraph && (
                    <svg
                      viewBox="0 0 920 210"
                      className="w-full h-full max-h-[220px] overflow-visible select-none"
                    >
                      <defs>
                        <linearGradient id="modalMedAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="modalMedStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="50%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>

                      {/* Grid markers */}
                      {modalMedGraph.gridHours.map((gh) => (
                        <g key={gh.hour}>
                          <line
                            x1={gh.x}
                            y1={modalMedGraph.padTop}
                            x2={gh.x}
                            y2={modalMedGraph.padTop + modalMedGraph.graphH}
                            stroke="rgba(255,255,255,0.08)"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={gh.x}
                            y={modalMedGraph.padTop + modalMedGraph.graphH + 18}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.4)"
                            fontSize="11.5"
                            fontWeight="600"
                            className="font-mono tabular-nums"
                          >
                            {String(gh.hour).padStart(2, '0')}:00
                          </text>
                        </g>
                      ))}

                      {/* Area Fill */}
                      <path d={modalMedGraph.areaD} fill="url(#modalMedAreaGrad)" />

                      {/* Curve Line */}
                      <path
                        d={modalMedGraph.curveD}
                        fill="none"
                        stroke="url(#modalMedStrokeGrad)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Vertical line and pulse node for NOW */}
                      {modalMedGraph.nowX !== null && modalMedGraph.nowY !== null && (
                        <g>
                          <line
                            x1={modalMedGraph.nowX}
                            y1={modalMedGraph.padTop}
                            x2={modalMedGraph.nowX}
                            y2={modalMedGraph.padTop + modalMedGraph.graphH}
                            stroke="rgba(255,255,255,0.5)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={modalMedGraph.nowX}
                            y={modalMedGraph.nowY - 14}
                            textAnchor="middle"
                            fill="#38bdf8"
                            fontSize="13"
                            fontWeight="700"
                            className="tabular-nums font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                          >
                            NOW: {pkStats?.currentLevel.toFixed(1)} ng/mL
                          </text>
                          <circle
                            cx={modalMedGraph.nowX}
                            cy={modalMedGraph.nowY}
                            r="10"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2"
                            opacity="0.6"
                            className="animate-pulse"
                          />
                          <circle
                            cx={modalMedGraph.nowX}
                            cy={modalMedGraph.nowY}
                            r="5"
                            fill="#ffffff"
                            stroke="#0b0f19"
                            strokeWidth="2"
                          />
                        </g>
                      )}
                    </svg>
                  )}
                </div>
              </div>

              {/* DOSE LOG DETAILS */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 mt-3 shrink-0">
                <div className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
                  Today&apos;s Administration Log
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {pkStats?.doses.map((d) => (
                    <div
                      key={d.id}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-white text-sm font-semibold">{d.name}</span>
                        <span className="text-white/40 text-xs">
                          {d.timesToday.length > 0
                            ? `Taken: ${d.timesToday
                                .map((t) =>
                                  new Date(t).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                )
                                .join(', ')}`
                            : `Scheduled: ${d.schedTime}`}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold tabular-nums ${
                          d.isTaken
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : 'bg-white/[0.05] text-white/40'
                        }`}
                      >
                        {d.isTaken ? `${d.takeCount}x Logged` : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ambientOpacityClass = isDeepSleep
    ? 'opacity-45'
    : isEvening
      ? 'opacity-80'
      : 'opacity-100';

  return (
    <main
      style={{ transform: `translate3d(${pixelShift.x}px, ${pixelShift.y}px, 0)` }}
      className={`h-screen w-screen overflow-hidden bg-black text-white p-8 flex flex-col justify-between gap-6 select-none font-sans transition-[opacity,transform] duration-[2500ms] ease-in-out ${ambientOpacityClass}`}
    >
      {renderModal()}

      {/* TOP HEADER */}
      <header className="grid grid-cols-12 gap-5 items-stretch shrink-0 h-32">
        <div className="col-span-3 flex flex-col justify-center">
          <div className="text-7xl xl:text-8xl font-medium tracking-tighter tabular-nums text-white/95 leading-none">
            {timeString}
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <span className="text-lg font-medium text-white/55 truncate">{dateString}</span>
            {lastSyncedAt && (
              <span
                title={`Last synced ${syncAgeMins ?? 0}m ago`}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${
                  isStale
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300/90'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isStale ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                {isStale ? `Stale ${syncAgeMins ?? ''}m` : 'Live'}
              </span>
            )}

            {/* TUYA SMART PLUGS (FAN & LAMP) */}
            <div className="flex items-center gap-2.5 shrink-0 ml-1.5">
              {/* Fan Circle */}
              <div
                title={
                  data.tuya?.fan === true
                    ? 'Fan: ON'
                    : data.tuya?.fan === false
                      ? 'Fan: OFF'
                      : 'Fan: Standby'
                }
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                  data.tuya?.fan === true
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_14px_rgba(34,211,238,0.55)]'
                    : 'bg-white/[0.05] text-white/30 border border-white/10'
                }`}
              >
                <Fan
                  className={`w-5 h-5 ${
                    data.tuya?.fan === true ? 'animate-spin [animation-duration:2.5s]' : ''
                  }`}
                />
              </div>

              {/* Lamp Circle */}
              <div
                title={
                  data.tuya?.lamp === true
                    ? 'Lamp: ON'
                    : data.tuya?.lamp === false
                      ? 'Lamp: OFF'
                      : 'Lamp: Standby'
                }
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                  data.tuya?.lamp === true
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-400/60 shadow-[0_0_14px_rgba(251,191,36,0.55)]'
                    : 'bg-white/[0.05] text-white/30 border border-white/10'
                }`}
              >
                <Lightbulb className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. UP NEXT (COMPACT) */}
        <GlassCard
          onClick={() => setManualModal('calendar')}
          className="col-span-2 flex flex-col justify-between !p-4 relative overflow-hidden transition-all duration-700"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  nextEventStatus.isActive
                    ? 'bg-emerald-400 animate-pulse'
                    : nextEvent
                      ? 'bg-sky-400 animate-pulse'
                      : 'bg-white/25'
                }`}
              />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                {nextEventStatus.isActive ? 'NOW ACTIVE' : 'UP NEXT'}
              </span>
            </div>
            {nextEventStatus.isSoon && (data.weather?.precipitation ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-400/25">
                <Umbrella className="w-2.5 h-2.5" />
                {data.weather.precipitation}mm
              </span>
            )}
          </div>
          <div
            className={`text-base xl:text-lg font-medium truncate ${
              nextEvent && isAcademicEvent(nextEvent.summary)
                ? 'text-purple-300 font-semibold'
                : 'text-white/95'
            }`}
          >
            {nextEvent ? nextEvent.summary : 'Clear Schedule'}
          </div>
          <div className="flex items-center justify-between gap-1 text-xs font-medium text-white/55 tabular-nums">
            <span className="truncate">
              {nextEvent ? getRelativeTime(nextEvent.start, nextEvent.end) : 'Relax'}
            </span>
            {nextEvent?.location && (
              <span className="text-[11px] text-white/40 truncate max-w-[85px]">
                {nextEvent.location}
              </span>
            )}
          </div>
          {nextEventStatus.isActive && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <div
                className="h-full bg-emerald-400/80 transition-all duration-1000"
                style={{ width: `${nextEventStatus.progressPct}%` }}
              />
            </div>
          )}
        </GlassCard>

        {/* 3. WEATHER */}
        <GlassCard className="col-span-2 !p-4 flex flex-col justify-between items-center text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Weather
          </span>
          <div className="flex items-center gap-2 tabular-nums">
            <span className={`text-3xl xl:text-4xl font-light tracking-tight ${tempColor}`}>
              {data.weather?.temp}
              <span className={tempColor}>°</span>
            </span>
            <WeatherIcon className={`w-6 h-6 ${weatherIconColor} ${weatherIconGlow}`} />
          </div>
          <div className="text-[11px] font-medium text-white/50 tabular-nums">
            {(data.weather?.precipitation ?? 0) > 0
              ? `${data.weather.precipitation}mm rain`
              : `AQI ${data.weather?.aqi ?? '--'}`}
          </div>
        </GlassCard>

        {/* 4. HALF SOVEREIGN GOLD */}
        <GlassCard className="col-span-2 !p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/90 truncate">
                ½ Sovereign
              </span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-amber-300/75 font-mono">
              3.66g
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-1 my-0.5 tabular-nums">
            <span
              className={`text-2xl xl:text-3xl font-light tracking-tight ${
                data.gold && data.gold.currentValue > 0
                  ? data.gold.isProfit
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                  : 'text-white'
              }`}
            >
              {data.gold?.currentValue ? `£${data.gold.currentValue.toFixed(2)}` : '£--'}
            </span>
            {data.gold && data.gold.currentValue > 0 && (
              <div
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-semibold tabular-nums border ${
                  data.gold.isProfit
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                {data.gold.isProfit ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                )}
                <span>
                  {data.gold.isProfit ? '+' : ''}£{Math.abs(data.gold.profitGbp).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/40 tabular-nums">
            <span>Cost: £385</span>
            <span>{data.gold?.gramPriceGbp ? `£${data.gold.gramPriceGbp.toFixed(2)}/g` : ''}</span>
          </div>
        </GlassCard>

        {/* 5. NOW PLAYING (TO THE RIGHT OF GOLD PRICE CARD) */}
        <GlassCard className="col-span-3 !p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-700">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  data.battery?.media?.isPlaying ? 'bg-pink-400 animate-pulse' : 'bg-white/30'
                }`}
              />
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                  data.battery?.media?.isPlaying ? 'text-pink-300' : 'text-white/50'
                }`}
              >
                <Music
                  className={`w-3.5 h-3.5 ${
                    data.battery?.media?.isPlaying ? 'animate-bounce text-pink-400' : 'text-white/40'
                  }`}
                />
                {data.battery?.media?.isPlaying ? 'Now Playing' : 'Apple Music'}
              </span>
            </div>
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
              {data.battery?.media?.isPlaying ? 'Playing' : 'Standby'}
            </span>
          </div>

          <div className="text-base xl:text-lg font-medium text-white/95 truncate">
            {data.battery?.media?.title || 'No Track Playing'}
          </div>

          <div className="flex items-center justify-between text-xs text-white/50 truncate">
            <span className="truncate">{data.battery?.media?.artist || 'Music Idle'}</span>
            {data.battery?.media?.album && (
              <span className="text-[10px] text-white/35 truncate hidden xl:inline">
                • {data.battery.media.album}
              </span>
            )}
          </div>

          {data.battery?.media?.isPlaying && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-80" />
          )}
        </GlassCard>
      </header>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* LEFT COLUMN */}
        <div className={`${leftColSpan} flex flex-col gap-3.5 min-h-0 transition-all duration-700`}>
          {/* 1. BIOMETRICS */}
          <GlassCard
            onClick={() => setManualModal('oura')}
            className="flex flex-col justify-between shrink-0 !p-5 !pb-4 relative"
          >
            <div className="absolute top-5 right-5 flex items-center gap-2.5">
              {(() => {
                const ouraCol = getOuraBatteryColor(data.oura?.battery);
                return (
                  <div
                    title={
                      data.oura?.battery !== undefined && data.oura?.battery !== null
                        ? `Ring Battery: ${data.oura.battery}%`
                        : 'Oura Ring Paired'
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold tabular-nums ${ouraCol.bg} ${ouraCol.border} ${ouraCol.text}`}
                  >
                    <Battery className={`w-3.5 h-3.5 ${ouraCol.icon}`} />
                    <span>
                      {data.oura?.battery !== undefined && data.oura?.battery !== null
                        ? `${data.oura.battery}%`
                        : 'Ring --%'}
                    </span>
                  </div>
                );
              })()}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-white/55 text-[11px] font-medium uppercase tracking-widest">
                <ChevronLeft className="w-3 h-3" /> Press
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-white/55" />
              <span className="font-semibold text-sm text-white/55 uppercase tracking-widest">
                Biometrics
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 tabular-nums">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-white/55 mb-0.5">
                  <span>Readiness</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${getScoreDotColor(data.oura?.readiness)}`}
                  />
                </div>
                <div className={`text-3xl font-light ${getBiometricScoreColor(data.oura?.readiness).text}`}>
                  {data.oura?.readiness}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-white/55 mb-0.5">
                  <span>Sleep</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${getScoreDotColor(data.oura?.sleep)}`}
                  />
                </div>
                <div className={`text-3xl font-light ${getBiometricScoreColor(data.oura?.sleep).text}`}>
                  {data.oura?.sleep}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/55 mb-0.5">Steps</div>
                <div className="text-3xl font-light text-white">{stepsFormatted}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-white/55 mb-0.5">Stress</div>
                <div className="text-3xl font-light text-white">
                  {data.oura?.stress}
                  <span className="text-sm text-white/45 ml-0.5">m</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* 2. 7-DAY SLEEP ARCHITECTURE (SMOOTH TELEMETRY LINE GRAPH) */}
          <GlassCard
            onClick={() => setManualModal('oura')}
            className="flex flex-col flex-1 min-h-[165px] !p-4.5 !py-3.5 relative overflow-hidden cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-sm text-white/60 uppercase tracking-widest">
                  Sleep Trend
                </span>
              </div>
              <div className="flex items-center gap-2 tabular-nums">
                {sleepStats.avgHours && (() => {
                  const avgCol = getSleepTrendDurationColor(Number(sleepStats.avgHours));
                  return (
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums border ${avgCol.bg} ${avgCol.border} ${avgCol.text}`}>
                      {sleepStats.avgHours}h avg
                    </span>
                  );
                })()}
                {sleepStats.avgScore && (() => {
                  const scoreCol = getBiometricScoreColor(sleepStats.avgScore);
                  return (
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums border ${scoreCol.bg} ${scoreCol.border} ${scoreCol.text}`}>
                      {sleepStats.avgScore} score
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* SVG TELEMETRY LINE GRAPH */}
            <div className="flex-1 min-h-0 flex items-center justify-center relative">
              {sleepGraphData && sleepGraphData.points.length > 0 ? (
                <svg
                  viewBox="0 0 380 148"
                  className="w-full h-full min-h-[145px] overflow-visible select-none"
                >
                  <defs>
                    <linearGradient id="sleepAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="sleepStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>

                  {/* 8h Target Guideline */}
                  <line
                    x1="18"
                    y1="51.5"
                    x2="356"
                    y2="51.5"
                    stroke="rgba(255,255,255,0.12)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x="358"
                    y="54.5"
                    fill="rgba(255,255,255,0.35)"
                    fontSize="9.5"
                    fontWeight="600"
                    textAnchor="start"
                    className="font-mono tabular-nums"
                  >
                    8h
                  </text>

                  {/* Gradient Area Fill */}
                  <path d={sleepGraphData.areaD} fill="url(#sleepAreaGrad)" />

                  {/* Smooth Curve Line */}
                  <path
                    d={sleepGraphData.curveD}
                    fill="none"
                    stroke="url(#sleepStrokeGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Day Nodes & Labels */}
                  {sleepGraphData.points.map((pt, i) => {
                    const durCol = getSleepTrendDurationColor(pt.hours);
                    return (
                      <g key={i}>
                        {/* Exact time label directly above node (0-5h: Red, 5-7h: Yellow, 7+h: Green) */}
                        <text
                          x={pt.x}
                          y={pt.y - 11}
                          textAnchor="middle"
                          fill={durCol.hex}
                          fontSize="12.5"
                          fontWeight="700"
                          className="tabular-nums font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                        >
                          {pt.timeStr}
                        </text>

                        {/* Pulsing ring for latest / today */}
                        {pt.isLatest && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="9"
                            fill="none"
                            stroke={durCol.hex}
                            strokeWidth="1.5"
                            opacity="0.6"
                            className="animate-pulse"
                          />
                        )}

                        {/* Node circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={pt.isLatest ? 5.5 : 4}
                          fill={durCol.hex}
                          stroke="#0b0f19"
                          strokeWidth="2.5"
                        />

                      {/* Day of week below */}
                      <text
                        x={pt.x}
                        y="134"
                        textAnchor="middle"
                        fill={pt.isLatest ? '#38bdf8' : 'rgba(255,255,255,0.65)'}
                        fontSize="12.5"
                        fontWeight="700"
                        className="uppercase tracking-wider font-sans"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}
                </svg>
              ) : (
                <div className="text-xs text-white/40 m-auto">Syncing sleep telemetry...</div>
              )}
            </div>
          </GlassCard>

          {/* 3. ADHD MEDICATION PROTOCOL (PHARMACOKINETICS) */}
          <GlassCard
            onClick={() => setManualModal('meds')}
            className="flex flex-col flex-1 min-h-[185px] !p-4.5 !py-3.5 relative cursor-pointer hover:bg-white/[0.05] transition-all group"
          >
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-sky-400" />
                <span className="font-semibold text-sm text-white/60 uppercase tracking-widest">
                  ADHD Medication
                </span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-lg font-bold ${
                      (pkStats?.currentLevel ?? 0) > 20
                        ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                        : 'text-white/60'
                    }`}
                  >
                    {pkStats?.currentLevel !== undefined ? pkStats.currentLevel.toFixed(1) : '--'}
                  </span>
                  <span className="text-[11px] font-medium text-white/45">ng/mL</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-white/60 text-[10px] font-medium uppercase tracking-wider">
                  <span>Press</span>
                  <ChevronUp className="w-3 h-3 text-sky-400 stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* DOSES STATUS PILLS */}
            <div className="flex items-center gap-1.5 mb-1.5 shrink-0 flex-wrap">
              {pkStats?.doses.map((d) => (
                <div
                  key={d.id}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border flex items-center gap-1 transition-all ${
                    d.isTaken
                      ? 'bg-sky-500/15 border-sky-500/35 text-sky-300'
                      : d.isOverdue
                        ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                        : 'bg-white/[0.04] border-white/10 text-white/45'
                  }`}
                >
                  {d.isTaken ? '✓ ' : ''}
                  <span>{d.shortName}</span>
                  {d.takeCount > 1 && <span className="opacity-75">({d.takeCount}x)</span>}
                  {!d.isTaken && <span className="opacity-60 text-[10px]">{d.schedTime}</span>}
                </div>
              ))}
              {pkStats?.nextDoseCountdown && (
                <div className="px-2 py-0.5 rounded-md text-[10.5px] font-medium tabular-nums border bg-sky-500/10 border-sky-500/25 text-sky-300 flex items-center gap-1">
                  <span className="opacity-75">⏱</span>
                  <span>{pkStats.nextDoseCountdown}</span>
                </div>
              )}
            </div>

            {/* MINI PK SPARKLINE GRAPH */}
            {medSparkline && (
              <div className="w-full flex-1 min-h-[90px] max-h-[125px] relative my-1 select-none flex items-center">
                <svg viewBox="0 0 360 100" className="w-full h-full min-h-[85px] overflow-visible">
                  <defs>
                    <linearGradient id="medAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="medStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="50%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>

                  {/* Grid hour markers */}
                  {medSparkline.gridHours.map((gh) => (
                    <g key={gh.hour}>
                      <line
                        x1={gh.x}
                        y1={medSparkline.padTop}
                        x2={gh.x}
                        y2={medSparkline.padTop + medSparkline.graphH}
                        stroke="rgba(255,255,255,0.08)"
                        strokeDasharray="2 2"
                      />
                      <text
                        x={gh.x}
                        y={medSparkline.padTop + medSparkline.graphH + 11}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.35)"
                        fontSize="9"
                        fontWeight="600"
                        className="font-mono tabular-nums"
                      >
                        {gh.hour}:00
                      </text>
                    </g>
                  ))}

                  {/* Gradient Area Fill */}
                  <path d={medSparkline.areaD} fill="url(#medAreaGrad)" />

                  {/* Smooth Concentration Curve */}
                  <path
                    d={medSparkline.curveD}
                    fill="none"
                    stroke="url(#medStrokeGrad)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Vertical line and pulse node for NOW */}
                  {medSparkline.nowX !== null && medSparkline.nowY !== null && (
                    <g>
                      <line
                        x1={medSparkline.nowX}
                        y1={medSparkline.padTop}
                        x2={medSparkline.nowX}
                        y2={medSparkline.padTop + medSparkline.graphH}
                        stroke="rgba(255,255,255,0.45)"
                        strokeWidth="1.2"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={medSparkline.nowX}
                        cy={medSparkline.nowY}
                        r="7"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        opacity="0.6"
                        className="animate-pulse"
                      />
                      <circle
                        cx={medSparkline.nowX}
                        cy={medSparkline.nowY}
                        r="4"
                        fill="#ffffff"
                        stroke="#0b0f19"
                        strokeWidth="2"
                      />
                    </g>
                  )}
                </svg>
              </div>
            )}

            {/* PK STATS FOOTER ROW */}
            <div className="flex items-center justify-between text-[11px] text-white/50 pt-1.5 border-t border-white/[0.05] tabular-nums shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white/35">Peak</span>
                <span className="text-white/85 font-medium">{pkStats?.peakTime || '--:--'}</span>
                {pkStats && pkStats.peakLevel > 0 && (
                  <span className="text-white/40 text-[10px]">
                    ({pkStats.peakLevel.toFixed(0)})
                  </span>
                )}
              </div>
              {pkStats?.focusWindow && (
                <div className="flex items-center gap-1 text-sky-300/90 font-medium">
                  <span className="text-white/35">Focus</span>
                  <span>{pkStats.focusWindow}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-white/35">Clear</span>
                <span className="text-sky-300/80 font-medium">
                  {pkStats?.sleepClearTime ? `${pkStats.sleepClearTime}` : pkStats?.clearTime || '--:--'}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* 4. HARDWARE & DEVICE FLEET */}
          <GlassCard className="flex flex-col shrink-0 !p-4 !py-3">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-xs text-white/60 uppercase tracking-widest">
                  Device Battery Levels
                </span>
              </div>
              <span className="text-[10px] text-white/40 tabular-nums">
                {data.battery?.updatedAt
                  ? `Live • ${new Date(data.battery.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Live'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs tabular-nums">
              {/* 1. MacBook Air */}
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col justify-between">
                <div className="flex items-center justify-between text-white/45 text-[11px] mb-1">
                  <div className="flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-sky-400" />
                    <span className="truncate">MacBook</span>
                  </div>
                  {data.battery?.macbook?.charging && (
                    <span className="text-amber-400 text-xs font-bold leading-none animate-pulse">⚡</span>
                  )}
                </div>
                <div className={`text-lg font-medium tracking-tight ${getDeviceBatteryColor(data.battery?.macbook?.percent).text}`}>
                  {data.battery?.macbook?.percent !== null && data.battery?.macbook?.percent !== undefined
                    ? `${data.battery.macbook.percent}%`
                    : '--%'}
                </div>
                <span className="text-[10px] text-white/40 truncate">
                  {data.battery?.macbook?.charging
                    ? 'Charging'
                    : data.battery?.macbook?.powerSource === 'AC'
                      ? 'Plugged In'
                      : 'Battery'}
                </span>
              </div>

              {/* 2. iPhone */}
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col justify-between">
                <div className="flex items-center justify-between text-white/45 text-[11px] mb-1">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate">iPhone</span>
                  </div>
                  {data.battery?.iphone?.charging && (
                    <span className="text-amber-400 text-xs font-bold leading-none animate-pulse">⚡</span>
                  )}
                </div>
                <div className={`text-lg font-medium tracking-tight ${getDeviceBatteryColor(data.battery?.iphone?.percent).text}`}>
                  {data.battery?.iphone?.percent !== null && data.battery?.iphone?.percent !== undefined
                    ? `${data.battery.iphone.percent}%`
                    : '--%'}
                </div>
                <span className="text-[10px] text-white/40 truncate">
                  {data.battery?.iphone?.charging ? 'Charging' : 'Active'}
                </span>
              </div>

              {/* 3. Logitech Keyboard */}
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-white/45 text-[11px] mb-1">
                  <Keyboard className="w-3.5 h-3.5 text-purple-400" />
                  <span className="truncate">Keyboard</span>
                </div>
                <div className={`text-lg font-medium tracking-tight ${getDeviceBatteryColor(data.battery?.keyboard?.percent).text}`}>
                  {data.battery?.keyboard?.percent !== null && data.battery?.keyboard?.percent !== undefined
                    ? `${data.battery.keyboard.percent}%`
                    : '--%'}
                </div>
                <span className="text-[10px] text-white/40 truncate">MX Keys</span>
              </div>

              {/* 4. Mouse / AirPods */}
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-white/45 text-[11px] mb-1">
                  {data.battery?.airpods ? (
                    <Headphones className="w-3.5 h-3.5 text-teal-400" />
                  ) : (
                    <Mouse className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span className="truncate">{data.battery?.airpods ? 'AirPods' : 'Mouse'}</span>
                </div>
                <div className={`text-lg font-medium tracking-tight ${
                  data.battery?.airpods
                    ? getDeviceBatteryColor(data.battery.airpods.left ?? data.battery.airpods.right).text
                    : data.battery?.mouse?.percent !== null && data.battery?.mouse?.percent !== undefined
                      ? getDeviceBatteryColor(data.battery.mouse.percent).text
                      : 'text-white'
                }`}>
                  {data.battery?.airpods
                    ? `${data.battery.airpods.left ?? data.battery.airpods.right ?? '--'}%`
                    : data.battery?.mouse?.percent !== null && data.battery?.mouse?.percent !== undefined
                      ? `${data.battery.mouse.percent}%`
                      : 'Active'}
                </div>
                <span className="text-[10px] text-white/40 truncate">
                  {data.battery?.airpods ? 'AirPods Pro' : 'Logi LIFT'}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className={`${rightColSpan} flex flex-col gap-6 min-h-0 transition-all duration-700`}>
          {/* SCHEDULE */}
          <GlassCard
            onClick={() => setManualModal('calendar')}
            className="flex flex-col flex-1 min-h-0 relative"
          >
            <div className="absolute top-6 right-6 flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-white/55 text-[11px] font-medium uppercase tracking-widest">
              Press <ChevronRight className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-2.5 mb-4 shrink-0">
              <Calendar className="w-4 h-4 text-white/55" />
              <span className="font-semibold text-sm text-white/55 uppercase tracking-widest">
                Schedule
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] text-white/55 tabular-nums">
                {eventsLeftToday} left today
              </span>
            </div>
            <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden pr-2">
              {Object.values(groupedEvents).length > 0 ? (
                <div className="h-full flex flex-col justify-between">
                  {Object.values(groupedEvents).map((group, gIdx) => (
                    <div key={gIdx} className="flex-1 flex flex-col justify-around mb-2 last:mb-0">
                      {group.isToday ? (
                        <div className="flex items-center justify-between mb-1.5 border-b border-sky-400/30 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                              Today
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          </div>
                          <span className="text-[11px] font-medium text-sky-300/70">
                            {now
                              ? now.toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  timeZone: TZ,
                                })
                              : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-white/55 uppercase tracking-widest mb-1.5 border-b border-white/10 pb-1.5">
                          {group.dateLabel}
                        </div>
                      )}
                      <div className="flex flex-col flex-1 justify-around">
                        {group.items.map((ev, idx) => {
                          const badge = getEventBadge(ev.summary);
                          const BadgeIcon = badge.icon;
                          const isUni = ev.calendar === 'Uni';
                          const evTime = new Date(ev.start).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: TZ,
                          });
                          const nowMs = now ? now.getTime() : 0;
                          const startMs = new Date(ev.start).getTime();
                          const endMs = ev.end ? new Date(ev.end).getTime() : startMs + 3600000;
                          const isActiveNow =
                            now !== null && startMs <= nowMs && endMs > nowMs;
                          const isPast = now !== null && endMs <= nowMs;

                          if (isPast) {
                            return (
                              <div
                                key={idx}
                                className="py-2.5 px-2 -mx-2 rounded-xl flex items-center justify-between gap-4 border-b border-white/[0.03] last:border-0 opacity-40 hover:opacity-80 transition-opacity"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <span className="w-[48px] text-sm font-medium tabular-nums text-white/40 shrink-0 line-through">
                                    {evTime}
                                  </span>
                                  <div className="w-2 h-2 rounded-full shrink-0 bg-white/20" />
                                  <span className={`text-lg font-medium truncate ${isAcademicEvent(ev.summary) ? 'text-purple-300/60' : 'text-white/50'}`}>
                                    {ev.summary}
                                  </span>
                                  {ev.location && (
                                    <span className="text-xs font-medium text-white/30 truncate hidden xl:inline">
                                      • {ev.location}
                                    </span>
                                  )}
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.02] border border-white/[0.04] shrink-0 text-white/35">
                                  <BadgeIcon className="w-3.5 h-3.5 opacity-50" />
                                  {badge.label}
                                </span>
                              </div>
                            );
                          }

                          if (isActiveNow) {
                            return (
                              <div
                                key={idx}
                                className="py-3 px-2 -mx-2 rounded-xl flex items-center justify-between gap-4 border-b border-white/[0.06] last:border-0 bg-emerald-500/[0.12] border border-emerald-500/25"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <span className="w-[48px] text-sm font-semibold tabular-nums text-emerald-300 shrink-0">
                                    {evTime}
                                  </span>
                                  <div className="w-2 h-2 rounded-full shrink-0 bg-emerald-400 animate-pulse" />
                                  <span className={`text-lg font-medium truncate ${isAcademicEvent(ev.summary) ? 'text-purple-200 font-semibold' : 'text-white'}`}>
                                    {ev.summary}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                                    Live
                                  </span>
                                  {ev.location && (
                                    <span className="text-xs font-medium text-white/60 truncate hidden xl:inline">
                                      • {ev.location}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.05] border border-white/[0.08] shrink-0 ${badge.color}`}
                                >
                                  <BadgeIcon className="w-3.5 h-3.5" />
                                  {badge.label}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={idx}
                              className="py-3 px-2 -mx-2 rounded-xl flex items-center justify-between gap-4 border-b border-white/[0.06] last:border-0"
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <span className="w-[48px] text-sm font-medium tabular-nums text-white/65 shrink-0">
                                  {evTime}
                                </span>
                                <div
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isUni ? 'bg-purple-400' : 'bg-white/50'
                                  }`}
                                />
                                <span className={`text-lg font-medium truncate ${isAcademicEvent(ev.summary) ? 'text-purple-300 font-semibold drop-shadow-[0_0_8px_rgba(216,180,254,0.35)]' : 'text-white/95'}`}>
                                  {ev.summary}
                                </span>
                                {ev.location && (
                                  <span className="text-xs font-medium text-white/45 truncate hidden xl:inline">
                                    • {ev.location}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.07] shrink-0 ${badge.color}`}
                              >
                                <BadgeIcon className="w-3.5 h-3.5" />
                                {badge.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/50 m-auto flex items-center justify-center h-full">
                  No upcoming schedule items
                </div>
              )}
            </div>
          </GlassCard>

          {/* TASKS & REMINDERS (TWO BALANCED COLUMNS, AUTO-SIZED TO FIT SPACE) */}
          <GlassCard
            onClick={() => setManualModal('reminders')}
            className="flex flex-col flex-1 min-h-0 relative"
          >
            <div className="absolute top-6 right-6 flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-white/55 text-[11px] font-medium uppercase tracking-widest">
              Press <ChevronDown className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-2.5 mb-3 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white/55" />
              <span className="font-semibold text-sm text-white/55 uppercase tracking-widest">
                Tasks &amp; Reminders
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] text-white/55 tabular-nums">
                {remindersLeftToday} left today
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden pr-2">
              {todayReminders.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-8 h-full content-between py-1">
                  {todayReminders.map((item, idx) => {
                    const listStyle = getReminderListStyle(item.list || item.listName);
                    const dueMeta = getReminderDueMeta(item);
                    return (
                      <div
                        key={item.id || idx}
                        className="py-2.5 px-2.5 rounded-xl flex items-center justify-between gap-3 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-3 h-3 rounded-full border-2 shrink-0 ${listStyle.border} bg-transparent`}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-base font-medium text-white/95 truncate leading-tight">
                              {item.title || item.text}
                            </span>
                            <span className={`text-[11px] font-medium capitalize ${listStyle.color}`}>
                              {listStyle.name}
                            </span>
                          </div>
                        </div>
                        {dueMeta.label && (
                          <span
                            className={`text-xs font-medium tabular-nums shrink-0 px-2.5 py-0.5 rounded-full ${
                              dueMeta.isOverdue
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : dueMeta.isToday
                                  ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                                  : 'text-white/55 bg-white/[0.04]'
                            }`}
                          >
                            {dueMeta.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm font-medium text-white/50 m-auto flex items-center justify-center h-full">
                  All done for today.
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}

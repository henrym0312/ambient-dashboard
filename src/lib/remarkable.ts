// Shared types, data normalizers, and monochrome geometry helpers for the reMarkable 2 (1872x1404 Landscape) E-Ink Dashboard

export const RM_WIDTH = 1872;
export const RM_HEIGHT = 1404;
export const RM_TZ = 'Europe/London';

export interface RmWeather {
  temp: number | string;
  precipitation: number;
  aqi: number | string;
  weatherCode: number;
  isDay: number;
}

export interface RmGold {
  paxgUsdt: number;
  gbpUsdt: number;
  gramPriceGbp: number;
  currentValue: number;
  purchasePrice: number;
  profitGbp: number;
  profitPct: number;
  isProfit: boolean;
}

export interface RmOuraHistoryDay {
  day: string;
  label: string;
  sleep: number;
  readiness: number;
  hours: number;
  formattedTime?: string;
}

export interface RmOura {
  readiness: number | string;
  sleep: number | string;
  steps: number | string;
  stress: string;
  battery?: number | null;
  history: RmOuraHistoryDay[];
}

export interface RmCalendarEvent {
  summary: string;
  start: string;
  end?: string;
  location?: string;
  calendar?: 'Main' | 'Uni' | string;
  isFullDay?: boolean;
}

export interface RmReminderItem {
  id?: string;
  title?: string;
  text?: string;
  dueDate?: string | null;
  hasTime?: boolean;
  priority?: number;
  flagged?: boolean;
  list?: string | { title?: string; name?: string };
  listName?: string;
  notes?: string;
}

export interface RmDashboardPayload {
  weather: RmWeather;
  oura: RmOura;
  events: RmCalendarEvent[];
  gold: RmGold;
  reminders: RmReminderItem[];
  updatedAt: string;
}

export function getWeatherConditionLabel(code: number = 0, isDay: number = 1): string {
  if (code >= 95) return 'Thunderstorm';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code === 3) return 'Overcast';
  if (code === 2) return 'Partly Cloudy';
  if (code === 1) return isDay ? 'Mainly Clear' : 'Clear Night';
  return isDay ? 'Clear Sky' : 'Clear Night';
}

export function formatSleepDuration(hours: number, formattedTime?: string): string {
  if (formattedTime && formattedTime !== '--') return formattedTime;
  if (!hours || hours <= 0) return '--';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getSmoothCurvePath(points: { x: number; y: number }[]): string {
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

export function getEventTypeTag(summary: string = ''): string {
  const s = summary.toLowerCase();
  if (s.includes('walk') || s.includes('->') || s.includes('transit') || s.includes('transport')) {
    return 'TRANSIT';
  }
  if (s.includes('lecture')) return 'LECTURE';
  if (s.includes('seminar')) return 'SEMINAR';
  if (s.includes('tutorial')) return 'TUTORIAL';
  return 'EVENT';
}

export function isAcademicEvent(summary: string = ''): boolean {
  const s = summary.toLowerCase();
  if (s.includes('walk') || s.includes('->') || s.includes('transit') || s.includes('transport')) {
    return false;
  }
  return s.includes('lecture') || s.includes('seminar') || s.includes('tutorial');
}

export function getRelativeTime(now: Date, startStr: string, endStr?: string): string {
  const nowMs = now.getTime();
  const startMs = new Date(startStr).getTime();
  const endMs = endStr ? new Date(endStr).getTime() : startMs + 3600000;

  if (startMs <= nowMs && endMs > nowMs) {
    const remMins = Math.max(1, Math.ceil((endMs - nowMs) / 60000));
    if (remMins < 60) return `${remMins}m remaining`;
    return `${Math.floor(remMins / 60)}h ${remMins % 60}m left`;
  }

  const diff = startMs - nowMs;
  if (diff <= 0) return 'Starting now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  return `in ${Math.floor(hrs / 24)}d`;
}

export function getNextEventStatus(now: Date, nextEvent: RmCalendarEvent | null) {
  if (!nextEvent) {
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
}

export function getReminderListLabel(rawList?: string | { title?: string; name?: string }): string {
  const l = (typeof rawList === 'string' ? rawList : rawList?.title || rawList?.name || 'Task')
    .trim()
    .toLowerCase();
  if (l.includes('household')) return 'Household';
  if (l.includes('health')) return 'Health';
  if (l.includes('finance')) return 'Finances';
  if (l.includes('work')) return 'Work';
  if (l.includes('shopping')) return 'Shopping';
  if (l.includes('uni')) return 'Uni';
  if (l.includes('duglj')) return 'DUGLJ';
  if (l.includes('exam')) return 'Exams';
  return (typeof rawList === 'string' ? rawList : rawList?.title || rawList?.name || 'Task').trim() || 'Task';
}

export function getReminderDueMeta(now: Date, item: RmReminderItem) {
  const todayIso = now.toLocaleDateString('en-CA', { timeZone: RM_TZ });
  const tomorrowIso = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', {
    timeZone: RM_TZ,
  });

  if (!item.dueDate) {
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
  const itemIso = d.toLocaleDateString('en-CA', { timeZone: RM_TZ });
  const showTime =
    item.hasTime !== undefined ? item.hasTime : d.getHours() !== 0 || d.getMinutes() !== 0;
  const timeStr = showTime
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: RM_TZ })
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
    timeZone: RM_TZ,
  });
  return {
    bucket: 'upcoming' as const,
    label: shortDate,
    isOverdue: false,
    isToday: false,
  };
}

export function selectTopReminders(now: Date, reminders: RmReminderItem[], limit: number = 8) {
  if (!reminders || reminders.length === 0) return { items: [], leftToday: 0 };

  const scored = reminders.map((item) => {
    const meta = getReminderDueMeta(now, item);
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

  const leftToday = scored.filter((s) => s.meta.isToday || s.meta.isOverdue).length;
  return {
    items: scored.slice(0, limit),
    leftToday,
  };
}

export function buildSleepChartModel(
  history: RmOuraHistoryDay[],
  width: number = 760,
  height: number = 240
) {
  const validHours = history.map((d) => d.hours).filter((h) => h > 0);
  const validScores = history.map((d) => d.sleep).filter((s) => s > 0);
  const avgHours =
    validHours.length > 0
      ? (validHours.reduce((acc, h) => acc + h, 0) / validHours.length).toFixed(1)
      : null;
  const avgScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((acc, s) => acc + s, 0) / validScores.length)
      : null;

  const padLeft = 52;
  const padRight = 56;
  const topY = 48;
  const bottomY = height - 66;
  const spanY = bottomY - topY;
  const stepX = history.length > 1 ? (width - padLeft - padRight) / (history.length - 1) : 0;

  // Map 3.5h -> bottomY, 9.5h -> topY
  const hourToY = (h: number) => {
    const clamped = Math.max(3.5, Math.min(9.5, h || 3.5));
    return Number((bottomY - ((clamped - 3.5) / 6.0) * spanY).toFixed(1));
  };

  const target8hY = hourToY(8.0);
  const target6hY = hourToY(6.0);

  const points = history.map((d, i) => {
    const x = Number((padLeft + i * stepX).toFixed(1));
    const y = hourToY(d.hours);
    return {
      x,
      y,
      hours: d.hours,
      sleepScore: d.sleep,
      timeStr: formatSleepDuration(d.hours, d.formattedTime),
      label: d.label.slice(0, 2).toUpperCase(),
      isLatest: i === history.length - 1,
    };
  });

  const curveD = getSmoothCurvePath(points);
  const areaD =
    points.length > 0
      ? `${curveD} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`
      : '';

  return {
    avgHours,
    avgScore,
    width,
    height,
    padLeft,
    padRight,
    topY,
    bottomY,
    target8hY,
    target6hY,
    points,
    curveD,
    areaD,
  };
}

export function groupCalendarEvents(now: Date, events: RmCalendarEvent[], maxEvents: number = 6) {
  const todayIso = now.toLocaleDateString('en-CA', { timeZone: RM_TZ });
  const nowMs = now.getTime();

  const eventsLeftToday = events.filter((ev) => {
    const evDate = new Date(ev.start);
    const iso = evDate.toLocaleDateString('en-CA', { timeZone: RM_TZ });
    if (iso !== todayIso) return false;
    const endMs = ev.end ? new Date(ev.end).getTime() : new Date(ev.start).getTime() + 3600000;
    return endMs > nowMs;
  }).length;

  const groups: { iso: string; dateLabel: string; isToday: boolean; items: RmCalendarEvent[] }[] = [];
  const map: Record<string, { iso: string; dateLabel: string; isToday: boolean; items: RmCalendarEvent[] }> = {};

  events.slice(0, maxEvents).forEach((ev) => {
    const evDate = new Date(ev.start);
    const iso = evDate.toLocaleDateString('en-CA', { timeZone: RM_TZ });
    const isToday = iso === todayIso;
    const dateLabel = isToday
      ? 'TODAY'
      : evDate
          .toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: RM_TZ,
          })
          .toUpperCase();
    if (!map[iso]) {
      map[iso] = { iso, dateLabel, isToday, items: [] };
      groups.push(map[iso]);
    }
    map[iso].items.push(ev);
  });

  return { groups, eventsLeftToday };
}

// Pharmacokinetic engine and data models for ADHD Medication tracking
// Matches the clinical single-compartment first-order absorption and elimination model used in Scriptable

export interface DoseConfig {
  id: string;
  name: string;
  shortName: string;
  type: 'LDX' | 'IR';
  mg: number;
  schedTime: string;
  ka: number; // absorption rate constant (1/h)
  ke: number; // elimination rate constant (1/h)
}

export const DOSES: DoseConfig[] = [
  {
    id: 'elvanse_40',
    name: 'Elvanse 40mg',
    shortName: 'Elvanse 40',
    type: 'LDX',
    mg: 40,
    schedTime: '09:00',
    ka: 0.75,
    ke: 0.068,
  },
  {
    id: 'elvanse_30',
    name: 'Elvanse 30mg',
    shortName: 'Elvanse 30',
    type: 'LDX',
    mg: 30,
    schedTime: '13:00',
    ka: 0.75,
    ke: 0.068,
  },
  {
    id: 'amfexa_10',
    name: 'Amfexa 10mg',
    shortName: 'Amfexa 10',
    type: 'IR',
    mg: 10,
    schedTime: '16:00',
    ka: 1.85,
    ke: 0.068,
  },
];

export interface MedLogPayload {
  date?: string;
  taken?: Record<string, string[]>;
  updatedAt?: string;
}

export interface DoseStatus {
  id: string;
  name: string;
  shortName: string;
  mg: number;
  schedTime: string;
  isTaken: boolean;
  takeCount: number;
  timesToday: string[];
  isOverdue: boolean;
}

export interface PKStats {
  currentLevel: number;
  peakTime: string;
  peakLevel: number;
  clearTime: string;
  doses: DoseStatus[];
  latestDoseTime: string | null;
  focusWindow?: string | null;
  nextDoseCountdown?: string | null;
  sleepClearTime?: string | null;
  inFocusZone: boolean;
  updatedAt?: string;
}

export interface CurvePoint {
  hour: number;
  conc: number;
}

// Single-dose Bateman equation
export function calculateDoseConc(
  doseDef: DoseConfig,
  takeTimeIso: string,
  targetDate: Date
): number {
  const takeDate = new Date(takeTimeIso);
  const dtHours = (targetDate.getTime() - takeDate.getTime()) / 3600000;
  if (dtHours <= 0) return 0;

  const scale = doseDef.type === 'LDX' ? doseDef.mg * 1.68 : doseDef.mg * 3.42;
  const conc =
    scale *
    (doseDef.ka / (doseDef.ka - doseDef.ke)) *
    (Math.exp(-doseDef.ke * dtHours) - Math.exp(-doseDef.ka * dtHours));
  return Math.max(0, conc);
}

// Total serum concentration across all historical doses (up to 7-day retention)
export function getTotalConcentration(
  targetDate: Date,
  takenMap: Record<string, string[]> = {}
): number {
  let total = 0;
  for (const d of DOSES) {
    const times = takenMap[d.id] || [];
    for (const timeIso of times) {
      total += calculateDoseConc(d, timeIso, targetDate);
    }
  }
  return total;
}

// Helper: Filter doses taken on a given calendar day
export function getTodayTimes(
  doseId: string,
  takenMap: Record<string, string[]> = {},
  now: Date
): string[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const allTimes = takenMap[doseId] || [];
  return allTimes.filter((iso) => {
    const t = new Date(iso);
    return t >= startOfToday && t <= endOfToday;
  });
}

function formatDayTime(dateObj: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[dateObj.getDay()];
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  return `${dayName} ${hh}:${mm}`;
}

export function computePKStats(now: Date, takenMap: Record<string, string[]> = {}): PKStats {
  const currentLevel = Number(getTotalConcentration(now, takenMap).toFixed(1));

  let latestDoseTime: Date | null = null;
  for (const k in takenMap) {
    for (const iso of takenMap[k] || []) {
      const t = new Date(iso);
      if (!latestDoseTime || t > latestDoseTime) latestDoseTime = t;
    }
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // 1. Peak concentration today (scanned in 5-minute increments)
  let maxC = 0;
  let peakDate: Date | null = null;
  for (
    const d = new Date(startOfToday);
    d <= endOfToday;
    d.setMinutes(d.getMinutes() + 5)
  ) {
    const c = getTotalConcentration(d, takenMap);
    if (c > maxC) {
      maxC = c;
      peakDate = new Date(d);
    }
  }

  // 2. Clearance time (< 1.0 ng/mL)
  let clearStr = '--:--';
  if (latestDoseTime) {
    const scanStart = new Date(
      Math.max(
        peakDate ? peakDate.getTime() : startOfToday.getTime(),
        latestDoseTime.getTime() + 2 * 3600 * 1000
      )
    );
    const scanEnd = new Date(latestDoseTime.getTime() + 14 * 24 * 3600 * 1000);
    let clearDate: Date | null = null;

    for (
      const d = new Date(scanStart);
      d <= scanEnd;
      d.setMinutes(d.getMinutes() + 5)
    ) {
      if (getTotalConcentration(d, takenMap) <= 1.0) {
        clearDate = new Date(d);
        break;
      }
    }

    if (currentLevel <= 1.0 && now > scanStart) {
      clearStr = 'Cleared';
    } else if (clearDate) {
      clearStr = formatDayTime(clearDate);
    }
  }

  const peakStr =
    peakDate && maxC > 0.1
      ? peakDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '--:--';

  // Dose status for today
  const currentHour = now.getHours();
  const doses: DoseStatus[] = DOSES.map((d) => {
    const timesToday = getTodayTimes(d.id, takenMap, now);
    const schedH = parseInt(d.schedTime.split(':')[0], 10);
    const isTaken = timesToday.length > 0;
    const isOverdue = !isTaken && currentHour >= schedH;

    return {
      id: d.id,
      name: d.name,
      shortName: d.shortName,
      mg: d.mg,
      schedTime: d.schedTime,
      isTaken,
      takeCount: timesToday.length,
      timesToday,
      isOverdue,
    };
  });

  // 3. Optimal Focus Window (concentration >= 20.0 ng/mL)
  let focusStart: Date | null = null;
  let focusEnd: Date | null = null;
  for (
    const d = new Date(startOfToday);
    d <= endOfToday;
    d.setMinutes(d.getMinutes() + 5)
  ) {
    const c = getTotalConcentration(d, takenMap);
    if (c >= 20.0) {
      if (!focusStart) focusStart = new Date(d);
      focusEnd = new Date(d);
    }
  }

  let focusWindow: string | null = null;
  if (focusStart && focusEnd && focusEnd.getTime() > focusStart.getTime()) {
    focusWindow = `${focusStart.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })} – ${focusEnd.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  // 4. Next Dose Countdown
  let nextDoseCountdown: string | null = null;
  const untakenDose = doses.find((d) => !d.isTaken);
  if (untakenDose) {
    const [sH, sM] = untakenDose.schedTime.split(':').map(Number);
    const doseDate = new Date(now);
    doseDate.setHours(sH, sM, 0, 0);
    const diffMs = doseDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins > 60) {
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      nextDoseCountdown = `${untakenDose.shortName} in ${hrs}h ${mins > 0 ? `${mins}m` : ''}`.trim();
    } else if (diffMins > 0) {
      nextDoseCountdown = `${untakenDose.shortName} in ${diffMins}m`;
    } else if (diffMins >= -30) {
      nextDoseCountdown = `${untakenDose.shortName} due now`;
    } else {
      nextDoseCountdown = `${untakenDose.shortName} (${Math.abs(diffMins)}m late)`;
    }
  } else if (doses.some((d) => d.isTaken)) {
    nextDoseCountdown = 'All doses complete ✓';
  }

  // 5. Sleep Clearance (< 5.0 ng/mL for uninhibited sleep onset)
  let sleepClearTime: string | null = null;
  if (latestDoseTime && peakDate) {
    const sleepScanStart = new Date(peakDate.getTime() + 60 * 60 * 1000);
    const sleepScanEnd = new Date(startOfToday.getTime() + 36 * 3600 * 1000);
    for (
      const d = new Date(sleepScanStart);
      d <= sleepScanEnd;
      d.setMinutes(d.getMinutes() + 5)
    ) {
      if (getTotalConcentration(d, takenMap) <= 5.0) {
        sleepClearTime = d.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });
        break;
      }
    }
  }

  return {
    currentLevel,
    peakTime: peakStr,
    peakLevel: Number(maxC.toFixed(1)),
    clearTime: clearStr,
    doses,
    latestDoseTime: latestDoseTime ? latestDoseTime.toISOString() : null,
    focusWindow,
    nextDoseCountdown,
    sleepClearTime,
    inFocusZone: currentLevel >= 20.0,
  };
}

// Generate the 24-hour plasma curve points for SVG rendering
export function generateDayCurve(
  now: Date,
  takenMap: Record<string, string[]> = {}
): {
  points: CurvePoint[];
  startHour: number;
  endHour: number;
  maxConc: number;
  currentHourDec: number;
  nowConc: number;
} {
  // Determine start hour based on earliest dose logged today
  let firstLogHour: number | null = null;
  for (const d of DOSES) {
    const times = getTodayTimes(d.id, takenMap, now);
    for (const t of times) {
      const dTime = new Date(t);
      const h = dTime.getHours() + dTime.getMinutes() / 60;
      if (firstLogHour === null || h < firstLogHour) firstLogHour = h;
    }
  }

  const currentHourDec = now.getHours() + now.getMinutes() / 60;
  const startHour =
    firstLogHour !== null
      ? Math.max(0, Math.floor(firstLogHour) - 1)
      : currentHourDec < 7
        ? 0
        : 7;
  const endHour = 24;

  const points: CurvePoint[] = [];
  let maxConc = 40;

  for (let h = startHour; h <= endHour; h += 0.25) {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(h), (h % 1) * 60);
    const c = getTotalConcentration(t, takenMap);
    if (c > maxConc) maxConc = c;
    points.push({ hour: h, conc: c });
  }

  const nowConc = getTotalConcentration(now, takenMap);

  return {
    points,
    startHour,
    endHour,
    maxConc,
    currentHourDec,
    nowConc,
  };
}

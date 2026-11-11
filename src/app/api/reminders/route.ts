import { NextResponse, connection } from 'next/server';
import { getRedis, isAuthorizedCron } from '@/lib/redis';

export interface NormalizedReminder {
  id?: string;
  title: string;
  dueDate?: string | null;
  hasTime?: boolean;
  priority?: number;
  flagged?: boolean;
  list: string;
  notes?: string;
}

interface RawReminderInput {
  id?: string;
  title?: string;
  name?: string;
  text?: string;
  dueDate?: string | null;
  deadline?: string | null;
  hasTime?: boolean;
  priority?: number | string;
  flagged?: boolean;
  completed?: boolean;
  isCompleted?: boolean;
  list?: string | { title?: string; name?: string };
  listName?: string;
  notes?: string;
}

function normalizeRemindersPayload(rawBody: unknown): NormalizedReminder[] {
  const rawList: unknown[] = Array.isArray(rawBody)
    ? rawBody
    : rawBody &&
        typeof rawBody === 'object' &&
        Array.isArray((rawBody as { items?: unknown[] }).items)
      ? (rawBody as { items: unknown[] }).items
      : [];

  const normalized: NormalizedReminder[] = [];

  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as RawReminderInput;

    // Skip completed items if a client or iOS Shortcut sends them unfiltered
    if (item.completed === true || item.isCompleted === true) continue;

    const title = (item.title || item.name || item.text || '').trim();
    if (!title) continue;

    const rawListField = item.list ?? item.listName ?? 'Task';
    const list = (
      typeof rawListField === 'string'
        ? rawListField
        : rawListField?.title || rawListField?.name || 'Task'
    ).trim();

    const rawDue = item.dueDate ?? item.deadline ?? null;
    let dueDate: string | null = null;
    let hasTime = Boolean(item.hasTime);

    if (typeof rawDue === 'string' && rawDue.trim().length > 0) {
      const parsed = new Date(rawDue);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.toISOString();
        if (item.hasTime === undefined) {
          // Fallback heuristic for legacy scripts that didn't explicitly send hasTime
          hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
        }
      }
    }

    const numPriority =
      typeof item.priority === 'number'
        ? item.priority
        : typeof item.priority === 'string'
          ? parseInt(item.priority, 10) || 0
          : 0;

    normalized.push({
      ...(item.id ? { id: String(item.id) } : {}),
      title,
      dueDate,
      hasTime,
      priority: numPriority,
      flagged: Boolean(item.flagged),
      list: list || 'Task',
      ...(item.notes ? { notes: String(item.notes).slice(0, 280) } : {}),
    });
  }

  // Sort: dated tasks first (earliest due date first), then flagged/high-priority, then alphabetical
  normalized.sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;

    if (Boolean(a.flagged) !== Boolean(b.flagged)) {
      return a.flagged ? -1 : 1;
    }

    // In EventKit, priority 1-4 is High, 5 is Medium, 9 is Low, 0 is None
    const aPrio = a.priority && a.priority > 0 ? a.priority : 99;
    const bPrio = b.priority && b.priority > 0 ? b.priority : 99;
    if (aPrio !== bPrio) return aPrio - bPrio;

    return a.title.localeCompare(b.title);
  });

  return normalized;
}

// GET: Fetches reminders for the TV dashboard to display
export async function GET() {
  await connection();
  try {
    const redis = await getRedis();
    const data = await redis.get('apple_reminders');
    if (!data) return NextResponse.json([]);

    const parsed: unknown = JSON.parse(data);
    return NextResponse.json(normalizeRemindersPayload(parsed));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch reminders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Receives tasks pushed from your Mac EventKit daemon or iOS Shortcut
export async function POST(req: Request) {
  try {
    if (!isAuthorizedCron(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await req.json();
    const normalized = normalizeRemindersPayload(body);

    const redis = await getRedis();
    await Promise.all([
      redis.set('apple_reminders', JSON.stringify(normalized)),
      redis.set(
        'apple_reminders_meta',
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          count: normalized.length,
        })
      ),
    ]);

    return NextResponse.json({
      success: true,
      count: normalized.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to store reminders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

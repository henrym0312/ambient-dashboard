import { NextResponse, connection } from 'next/server';
import tls from 'node:tls';
import { getRedis, isAuthorizedCron } from '@/lib/redis';

export interface EmailBoxCount {
  unread: number;
  total: number;
}

export interface EmailsPayload {
  gmail: EmailBoxCount;
  uni: EmailBoxCount;
  updatedAt?: string;
}

const DEFAULT_EMAILS: EmailsPayload = {
  gmail: { unread: 0, total: 0 },
  uni: { unread: 0, total: 0 },
};

function isValidBox(box: unknown): box is EmailBoxCount {
  if (!box || typeof box !== 'object') return false;
  const b = box as Record<string, unknown>;
  return (
    typeof b.unread === 'number' &&
    Number.isFinite(b.unread) &&
    b.unread >= 0 &&
    typeof b.total === 'number' &&
    Number.isFinite(b.total) &&
    b.total >= 0
  );
}

/**
 * Queries Gmail IMAP STATUS INBOX (MESSAGES UNSEEN) directly in ~120ms using native TLS
 * when GMAIL_USER and GMAIL_APP_PASSWORD are set in environment variables.
 */
function fetchGmailStatusDirect(user: string, appPass: string): Promise<EmailBoxCount | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: EmailBoxCount | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const socket = tls.connect(
      { host: 'imap.gmail.com', port: 993, servername: 'imap.gmail.com' },
      () => {
        // Wait for server greeting before sending commands
      }
    );

    socket.setTimeout(4000, () => {
      socket.destroy();
      finish(null);
    });

    socket.on('error', () => {
      socket.destroy();
      finish(null);
    });

    let buffer = '';
    let step: 'greeting' | 'login' | 'status' = 'greeting';
    const cleanPass = appPass.replace(/\s+/g, '');

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');

      if (step === 'greeting' && buffer.includes('* OK')) {
        buffer = '';
        step = 'login';
        socket.write(`A1 LOGIN "${user}" "${cleanPass}"\r\n`);
      } else if (step === 'login') {
        if (buffer.includes('A1 OK')) {
          buffer = '';
          step = 'status';
          socket.write('A2 STATUS INBOX (MESSAGES UNSEEN)\r\n');
        } else if (buffer.includes('A1 NO') || buffer.includes('A1 BAD')) {
          socket.end('A3 LOGOUT\r\n');
          finish(null);
        }
      } else if (step === 'status') {
        const match = buffer.match(/MESSAGES\s+(\d+)\s+UNSEEN\s+(\d+)/i);
        if (match) {
          const total = parseInt(match[1], 10);
          const unread = parseInt(match[2], 10);
          socket.end('A3 LOGOUT\r\n');
          finish({ unread, total });
        } else if (buffer.includes('A2 NO') || buffer.includes('A2 BAD')) {
          socket.end('A3 LOGOUT\r\n');
          finish(null);
        }
      }
    });
  });
}

export async function GET() {
  await connection();
  try {
    const redis = await getRedis();
    const raw = await redis.get('apple_emails');
    const stored: EmailsPayload = raw ? { ...DEFAULT_EMAILS, ...JSON.parse(raw) } : { ...DEFAULT_EMAILS };

    // Guard against legacy corrupted {"error": "..."} payloads stored in Redis
    if (!isValidBox(stored.gmail)) stored.gmail = { unread: 0, total: 0 };
    if (!isValidBox(stored.uni)) stored.uni = { unread: 0, total: 0 };

    // Optional direct cloud Gmail fetch if GMAIL_USER & GMAIL_APP_PASSWORD are set
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (gmailUser && gmailPass) {
      const liveGmail = await fetchGmailStatusDirect(gmailUser, gmailPass);
      if (liveGmail) {
        stored.gmail = liveGmail;
        stored.updatedAt = new Date().toISOString();
        await redis.set('apple_emails', JSON.stringify(stored));
      }
    }

    return NextResponse.json(stored);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorizedCron(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || 'error' in body) {
      return NextResponse.json(
        { error: 'Rejected invalid or error email payload; preserving cached counts' },
        { status: 400 }
      );
    }

    const incoming = body as Record<string, unknown>;
    const hasValidGmail = isValidBox(incoming.gmail);
    const hasValidUni = isValidBox(incoming.uni);

    if (!hasValidGmail && !hasValidUni) {
      return NextResponse.json(
        { error: 'Payload must contain valid gmail or uni { unread, total } numbers' },
        { status: 400 }
      );
    }

    const redis = await getRedis();
    const existingRaw = await redis.get('apple_emails');
    const existing: EmailsPayload = existingRaw
      ? { ...DEFAULT_EMAILS, ...JSON.parse(existingRaw) }
      : { ...DEFAULT_EMAILS };

    const merged: EmailsPayload = {
      gmail: hasValidGmail ? (incoming.gmail as EmailBoxCount) : isValidBox(existing.gmail) ? existing.gmail : { unread: 0, total: 0 },
      uni: hasValidUni ? (incoming.uni as EmailBoxCount) : isValidBox(existing.uni) ? existing.uni : { unread: 0, total: 0 },
      updatedAt: new Date().toISOString(),
    };

    await redis.set('apple_emails', JSON.stringify(merged));
    return NextResponse.json({ success: true, emails: merged });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to store emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

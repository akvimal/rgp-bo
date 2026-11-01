/**
 * The rules of sending alerts outside the app (staff on Telegram first). Pure: no framework, no database, relative imports only, so they are unit tested.
 */
export type Severity = 'info' | 'warning' | 'critical';
export const SEVERITIES: Severity[] = ['info', 'warning', 'critical'];
const RANK: Record<string, number> = { info: 0, warning: 1, critical: 2 };

/** a person asks for alerts of a level and above; an unknown level counts as a warning */
export const passesSeverity = (min: string, severity: string): boolean => (RANK[severity] ?? 1) >= (RANK[min] ?? 1);

const MINUTES = /^([01]?\d|2[0-3]):([0-5]\d)$/;
/** minutes since midnight of "HH:MM", or null when it is not a time */
export function toMinutes(hhmm: string | null | undefined): number | null {
  const m = MINUTES.exec(String(hhmm ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** is this minute of the day inside the quiet hours (which may run past midnight, 22:00 to 07:00)? No quiet hours set means never. */
export function inQuiet(minuteOfDay: number, from: string | null | undefined, to: string | null | undefined): boolean {
  const a = toMinutes(from), b = toMinutes(to);
  if (a === null || b === null || a === b) return false;
  return a < b ? minuteOfDay >= a && minuteOfDay < b : minuteOfDay >= a || minuteOfDay < b;
}

const IST_MS = 5.5 * 3600000;
/** the minute of the day in India time for an instant */
export const istMinute = (at: Date): number => { const d = new Date(at.getTime() + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

/** the next instant the quiet hours end (the "to" time in India time), from `at` */
export function quietEnds(at: Date, to: string): Date {
  const end = toMinutes(to) ?? 0;
  const now = istMinute(at);
  const wait = (end - now + 1440) % 1440 || 1440;
  const sec = new Date(at.getTime() + IST_MS).getUTCSeconds();
  return new Date(at.getTime() + wait * 60000 - sec * 1000);
}

/** when a message that could not be sent is tried again, by the number of tries so far; null after the last */
export const RETRY_MINUTES = [1, 5, 30, 120, 360];
export const retryAfterMinutes = (attempts: number): number | null => (attempts >= 1 && attempts <= RETRY_MINUTES.length ? RETRY_MINUTES[attempts - 1] : null);

/** a person is not sent more than this many messages of a lower level than critical in an hour; a critical one always goes */
export const HOURLY_CAP = 12;
export const overCap = (sentLastHour: number, severity: string): boolean => severity !== 'critical' && sentLastHour >= HOURLY_CAP;

const ICON: Record<string, string> = { critical: '\u{1F534}', warning: '\u{1F7E0}', info: '\u{2139}\u{FE0F}' };

/** the text of an alert as a person reads it in Telegram: level, title, what to do, and a link to open it in the app when the app has a public address */
export function formatAlert(m: { title: string; body: string; severity: string; link?: string | null; baseUrl?: string | null }): string {
  const base = String(m.baseUrl ?? '').replace(/\/$/, '');
  const link = m.link && /^https:\/\//.test(base) ? `${base}${m.link.startsWith('/') ? '' : '/'}${m.link}` : '';
  return [`${ICON[m.severity] ?? ICON.warning} ${m.title}`, m.body, link].filter(Boolean).join('\n').slice(0, 4000);
}

export type Command =
  | { kind: 'start'; token: string; chatId: string; handle: string | null }
  | { kind: 'stop' | 'status' | 'help' | 'other'; chatId: string };

/** what a person typed to the bot: only private chats count; /start carries the one-time link token */
export function parseUpdate(update: any): Command | null {
  const msg = update?.message;
  if (!msg || msg.chat?.type !== 'private' || msg.chat?.id === undefined || msg.chat?.id === null) return null;
  const chatId = String(msg.chat.id);
  const text = String(msg.text ?? '').trim();
  const [cmd, ...rest] = text.split(/\s+/);
  const name = cmd.replace(/@\w+$/, '').toLowerCase();
  if (name === '/start') return { kind: 'start', token: (rest[0] ?? '').slice(0, 64), chatId, handle: msg.from?.username ? String(msg.from.username).slice(0, 80) : null };
  if (name === '/stop') return { kind: 'stop', chatId };
  if (name === '/status') return { kind: 'status', chatId };
  if (name === '/help') return { kind: 'help', chatId };
  return { kind: 'other', chatId };
}

/** tokens are random and one use; only this hash is stored */
export const TOKEN_MINUTES = 15;

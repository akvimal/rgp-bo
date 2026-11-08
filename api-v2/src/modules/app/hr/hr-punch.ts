/** Rules of the attendance punch, kept free of the database so they can be tested on their own. */

export const PIN_FAILS_ALLOWED = 5;
export const PIN_LOCK_MINUTES = 10;
/** a second punch inside this is taken as a double tap */
export const DOUBLE_TAP_SECONDS = 60;
export const MIN_PHOTO_BYTES = 2_000;
export const MAX_PHOTO_BYTES = 400_000;

export type PunchKind = 'IN' | 'OUT';

export const isValidPin = (pin: any): boolean => /^\d{4,6}$/.test(String(pin ?? ''));

/** the next punch of a person: In first, then Out, then (a new In would be a second shift) nothing more that day */
export function nextKind(last: PunchKind | null | undefined): PunchKind | null {
  if (!last) return 'IN';
  return last === 'IN' ? 'OUT' : null;
}

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** LATE for an In after the shift start plus the grace; EARLY_OUT for an Out before the shift end less the grace */
export function punchFlags(kind: PunchKind, local: string, workStart: string | null, workEnd: string | null, grace: number): string[] {
  if (kind === 'IN' && workStart && minutes(local) > minutes(workStart) + grace) return ['LATE'];
  if (kind === 'OUT' && workEnd && minutes(local) < minutes(workEnd) - grace) return ['EARLY_OUT'];
  return [];
}

/** a photo sent as a data URL (or plain base64) of a JPEG: its bytes, or why it is refused */
export function decodePhoto(input: any): { ok: true; bytes: Buffer } | { ok: false; reason: string } {
  const raw = String(input ?? '');
  const m = /^data:image\/jpe?g;base64,(.*)$/s.exec(raw);
  const b64 = m ? m[1] : raw;
  if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return { ok: false, reason: 'A photo is needed to mark attendance.' };
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length < MIN_PHOTO_BYTES) return { ok: false, reason: 'The photo is empty. Check the camera and try again.' };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, reason: 'The photo is too large.' };
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return { ok: false, reason: 'The photo is not a JPEG picture.' };
  return { ok: true, bytes };
}

/** whether a person is locked out of the PIN (too many wrong tries): minutes left, or 0 */
export function lockMinutesLeft(lockedUntil: Date | string | null | undefined, now: Date = new Date()): number {
  if (!lockedUntil) return 0;
  const ms = new Date(lockedUntil).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

/** every date from `from` to `to` (YYYY-MM-DD, both included) */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** a 4-digit PIN that is not an obvious one (1111, 1234, 0000 ...) */
export function generatePin(random: () => number = Math.random): string {
  for (let i = 0; i < 50; i++) {
    const p = String(Math.floor(random() * 10000)).padStart(4, '0');
    const d = p.split('').map(Number);
    const same = d.every(x => x === d[0]);
    const run = d.every((x, i2) => i2 === 0 || x === d[i2 - 1] + 1) || d.every((x, i2) => i2 === 0 || x === d[i2 - 1] - 1);
    if (!same && !run) return p;
  }
  return '7391';
}

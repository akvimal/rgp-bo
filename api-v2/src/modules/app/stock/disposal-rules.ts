/**
 * The out-pass for goods that leave the shop as waste. Pure rules: the service reads and writes.
 *   DRAFT      waiting for a Store Head or Business Head
 *   APPROVED   the quantity is held: still on the books, not saleable
 *   CONFIRMED  handed over or destroyed: the stock drops (one adjustment per line) and scheduled drugs go in the disposal register
 *   REJECTED / CANCELLED   nothing moved; the hold, if any, is released
 */
export const PASS_REASONS = ['EXPIRED', 'NEAR_EXPIRY', 'DAMAGED'] as const;
export const PASS_METHODS = ['DESTROYED', 'AGENCY', 'VENDOR', 'OTHER'] as const;
export const SCHEDULES = ['H', 'H1', 'X'] as const;
export type PassReason = (typeof PASS_REASONS)[number];
export type PassMethod = (typeof PASS_METHODS)[number];

export const REASON_LABEL: Record<string, string> = { EXPIRED: 'Expired', NEAR_EXPIRY: 'Near expiry', DAMAGED: 'Damaged' };
export const METHOD_LABEL: Record<string, string> = { DESTROYED: 'Destroyed on site', AGENCY: 'Handed to a disposal agency', VENDOR: 'Returned to the vendor', OTHER: 'Other' };

/** OP-2026-0007: per business, the number restarts each year */
export const passNumber = (year: number, seq: number): string => `OP-${year}-${String(seq).padStart(4, '0')}`;

/** the reason code of the stock adjustment a confirmed line posts: a return to the vendor is a return, anything else is expired or damaged stock */
export function adjustmentReason(reason: string, method: string): 'EXPIRED' | 'DAMAGED' | 'RETURNED_TO_VENDOR' {
  if (method === 'VENDOR') return 'RETURNED_TO_VENDOR';
  return reason === 'DAMAGED' ? 'DAMAGED' : 'EXPIRED';
}

/**
 * Whether confirming needs a second staff member as witness: a Schedule H, H1 or X line, confirmed by someone who is not a Business Head or a Store Head.
 * (A manager's own confirmation stands.)
 */
export function needsWitness(lines: Array<{ schedule?: string | null }>, confirmerIsManager: boolean): boolean {
  return !confirmerIsManager && lines.some((l) => (SCHEDULES as readonly string[]).includes(String(l.schedule || '').toUpperCase()));
}

const DAY = 86400000;
const dayNo = (iso: string): number => Math.floor(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / DAY);

/** the last day of the month an expiry (stored as the 1st) falls in: a "08/27" batch is good until 31 August 2027 */
export function expiryEnd(exp: string): string {
  const d = new Date(Date.parse(exp.slice(0, 10) + 'T00:00:00Z'));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/** how a batch stands against the expiry: how many days past it, or how many days it has left */
export function daysToExpiry(exp: string, today: string): number {
  return dayNo(expiryEnd(exp)) - dayNo(today);
}

/**
 * Whether the batch's vendor takes it back, given what the vendor's setting says: the kind (near expiry, expired or both) and the days either side of the
 * expiry the vendor accepts (no days: no limit).
 */
export function canReturnToVendor(vendor: { takesback?: string | null; takebackdays?: number | null }, exp: string | null, today: string): boolean {
  const kind = String(vendor?.takesback || 'NONE').toUpperCase();
  if (!exp || kind === 'NONE') return false;
  const left = daysToExpiry(exp, today);
  const expired = left < 0;
  if (expired && !(kind === 'EXPIRED' || kind === 'BOTH')) return false;
  if (!expired && !(kind === 'NEAR_EXPIRY' || kind === 'BOTH')) return false;
  const limit = vendor.takebackdays;
  if (limit === null || limit === undefined) return true;
  return Math.abs(left) <= Number(limit);
}

/** the band of the Expiry screen a batch falls in */
export type ExpiryBand = 'EXPIRED' | 'D30' | 'D90' | 'D180';
export function bandOf(exp: string | null, today: string): ExpiryBand | null {
  if (!exp) return null;
  const left = daysToExpiry(exp, today);
  if (left < 0) return 'EXPIRED';
  if (left <= 30) return 'D30';
  if (left <= 90) return 'D90';
  if (left <= 180) return 'D180';
  return null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** what a line is worth: at cost before GST, the GST paid on that cost, and at the MRP. `pack` is the units in a pack; prices are per pack. */
export function lineValues(qty: number, pack: number, ptrValue: number, taxPcnt: number, mrpCost: number): { cost: number; tax: number; mrp: number } {
  const p = pack > 0 ? pack : 1;
  const cost = r2((qty * (Number(ptrValue) || 0)) / p);
  return { cost, tax: r2((cost * (Number(taxPcnt) || 0)) / 100), mrp: r2((qty * (Number(mrpCost) || 0)) / p) };
}

/**
 * Who may approve a pass: a Store Head of its store, or a Business Head or Owner-operator. A person approves their own pass only when they are an owner, or the
 * store works in "the maker may approve" mode.
 */
export function approverProblem(a: { role: string; isOwner: boolean; isManager: boolean; storeIsMine: boolean; isMaker: boolean; selfMode: boolean }): string | null {
  if (!a.isManager) return 'Only a Store Head or a Business Head can approve an out-pass.';
  if (!a.isOwner && !a.storeIsMine) return 'That out-pass is for a store you do not run.';
  if (a.isMaker && !a.isOwner && !a.selfMode) return 'You cannot approve your own out-pass. Another Store Head or the Business Head approves it.';
  return null;
}

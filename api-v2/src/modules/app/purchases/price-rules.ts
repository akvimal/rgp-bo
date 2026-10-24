/** Why a vendor's rate went up, as the receiver records it. */
export const PRICE_REASONS = ['PRICE_REVISED', 'NEW_BATCH', 'SCHEME_ENDED', 'VENDOR_ERROR', 'UNIT_CHANGED'] as const;
export type PriceReason = typeof PRICE_REASONS[number];

export const DEFAULT_PRICE_TOLERANCE_PCT = 0.5;
export const DEFAULT_PRICE_APPROVAL_PCT = 5;

/** NONE: nothing to say. REASON: a reason is needed to complete. APPROVAL: a reason, and a Store Head or Business Head to complete. */
export type PriceLevel = 'NONE' | 'REASON' | 'APPROVAL';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The rate actually paid per unit: the printed rate less the line's discount. */
export function netRate(ptrValue: number | string | null, discPcnt: number | string | null): number {
  return round2(Number(ptrValue || 0) * (1 - Number(discPcnt || 0) / 100));
}

/**
 * Compares this line's net rate with the vendor's previous net rate for the product. Only a rise matters: a fall, no
 * previous purchase and a zero rate all say nothing. A rise within the tolerance passes; above the approval percent it needs approval.
 */
export function classifyChange(prev: number | null, now: number, tolerancePct: number, approvalPct: number): { pcnt: number | null; level: PriceLevel } {
  if (prev === null || !(prev > 0) || !(now > 0)) return { pcnt: null, level: 'NONE' };
  const pcnt = round2(((now - prev) / prev) * 100);
  if (pcnt <= tolerancePct) return { pcnt, level: 'NONE' };
  return { pcnt, level: pcnt > approvalPct ? 'APPROVAL' : 'REASON' };
}

/** An MRP this many times the last purchase's (or a tenth of it) is a different pack or unit, not a price move. */
export const UNIT_JUMP_RATIO = 2.5;

/**
 * The same product bought with an MRP that jumped (or fell) by a large factor against its last purchase: a box of ten one time
 * and single pieces the next. Returns the factor, or null when the MRP is in the ordinary range or either side is missing.
 */
export function unitJump(prevMrp: number | null, mrp: number | null): number | null {
  if (!(Number(prevMrp) > 0) || !(Number(mrp) > 0)) return null;
  const ratio = Number(mrp) / Number(prevMrp);
  return ratio >= UNIT_JUMP_RATIO || ratio <= 1 / UNIT_JUMP_RATIO ? round2(ratio) : null;
}

/** A setting value read as a percent between 0 and 100, else the default. */
export function percentSetting(raw: any, fallback: number): number {
  const n = Number(raw);
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
}

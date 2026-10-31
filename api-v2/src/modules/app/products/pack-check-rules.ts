/** Why a flagged pack is left as it is, in the words the screen shows. */
export const DISMISS_REASONS: Record<string, string> = {
  MAKER_CHANGED_PACK: 'The maker changed the pack',
  SOLD_LOOSE_AND_FULL: 'Sold loose and in full packs',
  ONE_OFF: 'A one-off purchase, nothing to correct',
  OTHER: 'Other',
};

/** Why the pack was changed. */
export const FIX_REASONS: Record<string, string> = {
  PACK_WRONG: 'The pack size was entered wrongly',
  PACKING_CHANGED: 'The maker changed the pack',
  OTHER: 'Other',
};

export interface ResolutionInput { reason: string; note: string | null; }

/** A reason from the list; "Other" has to say what, in a few words. Returns the cleaned input, or the message to show. */
export function checkReason(body: { reason?: unknown; note?: unknown } | null | undefined, allowed: Record<string, string>): { ok: true; value: ResolutionInput } | { ok: false; message: string } {
  const reason = String(body?.reason ?? '');
  if (!allowed[reason]) return { ok: false, message: 'Choose a reason.' };
  const note = String(body?.note ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (reason === 'OTHER' && note.length < 3) return { ok: false, message: 'Say in a few words why.' };
  return { ok: true, value: { reason, note: note || null } };
}

/** a pack is a whole number of units, at least 1 */
export function checkPack(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : null;
}

/**
 * The packs that would explain a big change in MRP between purchases. The MRP is per pack, so MRP changing by a factor of ten while the
 * product is the same usually means a pack of ten times more (or fewer) units. `mrps` runs from the newest purchase back; the newest
 * big change is used. Only whole-number packs are offered, and never the current one. The person decides which side is right.
 */
export function packCandidates(currentPack: number, mrps: number[]): { ratio: number; packs: number[] } | null {
  for (let i = 0; i + 1 < mrps.length; i++) {
    const later = mrps[i], earlier = mrps[i + 1];
    if (!(later > 0) || !(earlier > 0)) continue;
    const r = later / earlier;
    if (r >= 2.5 || r <= 0.4) {
      const f = r >= 1 ? r : 1 / r;
      const whole = Math.round(f);
      if (whole < 2 || Math.abs(f - whole) / f > 0.15) return { ratio: Math.round(r * 100) / 100, packs: [] };
      const packs = [currentPack * whole];
      if (currentPack % whole === 0) packs.push(currentPack / whole);
      return { ratio: Math.round(r * 100) / 100, packs: packs.filter((p) => p >= 1 && p !== currentPack) };
    }
  }
  return null;
}

export interface BatchFacts { id: number; purchaseQty: number; soldAndAdjusted: number; ptr: number; }

export interface PackImpact {
  oldPack: number;
  newPack: number;
  batches: number;
  unitsBefore: number;
  unitsAfter: number;
  valueBefore: number;
  valueAfter: number;
  /** batches that have sold more units than the new pack would give them: the change cannot be made while these exist */
  belowZero: number;
}

/**
 * What changing the pack does to stock. Units on hand are the packs bought times the pack, less what was sold or adjusted, so a new
 * pack restates every batch. `ptr` is the rate per pack; the cost of a unit is the rate over the pack.
 */
export function packImpact(batches: BatchFacts[], oldPack: number, newPack: number): PackImpact {
  let unitsBefore = 0, unitsAfter = 0, valueBefore = 0, valueAfter = 0, belowZero = 0;
  for (const b of batches) {
    const before = b.purchaseQty * oldPack - b.soldAndAdjusted;
    const after = b.purchaseQty * newPack - b.soldAndAdjusted;
    if (after < 0) belowZero++;
    if (before > 0) { unitsBefore += before; valueBefore += before * (b.ptr / oldPack); }
    if (after > 0) { unitsAfter += after; valueAfter += after * (b.ptr / newPack); }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { oldPack, newPack, batches: batches.length, unitsBefore, unitsAfter, valueBefore: r2(valueBefore), valueAfter: r2(valueAfter), belowZero };
}

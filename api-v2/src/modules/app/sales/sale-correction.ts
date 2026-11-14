/**
 * Correcting a bill's details after it was rung: how it was paid (cash and digital), who served, and the prescription detail.
 * The lines and the total never change here (that is a return, or a void). Allowed only in the shift the bill was rung in, while it is open.
 * Pure rules, so the screen and the server give the same answer.
 */

export const MIN_REASON = 3;

export interface CorrectionFacts {
  status: string;
  shiftId: number | null;
  shiftStatus: string | null;
  returns: number;
  isOwn: boolean;
  canCorrectAny: boolean;
}

/** the first thing that stops the bill being corrected, in plain words; null when it may be */
export function correctionProblem(f: CorrectionFacts): string | null {
  const status = `${f.status}`.toUpperCase();
  if (status === 'VOID') return 'This bill is voided.';
  if (status !== 'COMPLETE') return 'Only a completed bill can be corrected: a held bill is edited on the sale screen.';
  if (f.returns > 0) return 'Something was already returned against this bill, so its details are fixed.';
  if (!f.shiftId) return 'This bill is not on a shift, so it cannot be corrected. Ask a manager.';
  if (`${f.shiftStatus}`.toUpperCase() !== 'OPEN') return 'Its shift is closed: a bill can be corrected only during the shift it was rung in.';
  if (!f.isOwn && !f.canCorrectAny) return 'You can correct only the bills you rang up. Ask a manager.';
  return null;
}

export function reasonProblem(reason: any): string | null {
  return `${reason ?? ''}`.trim().length >= MIN_REASON ? null : 'Say why the bill is being corrected.';
}

export interface Tender { cash: number; digital: number; method?: string | null; refno?: string | null }

const money = (n: any) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * The cash and digital parts may be moved between each other, but together they must stay what they were: the rest of the bill
 * (credit, dues, an advance) is not touched here.
 */
export function paymentProblem(before: Tender, after: Tender): string | null {
  if (money(after.cash) < 0 || money(after.digital) < 0) return 'An amount cannot be negative.';
  if (money(after.cash + after.digital) !== money(before.cash + before.digital)) {
    return `Cash and digital together must stay ${money(before.cash + before.digital).toFixed(2)}. To change what the customer owes or used, void the bill and ring it again.`;
  }
  if (money(after.digital) > 0 && !`${after.method ?? ''}`.trim()) return 'Choose how the digital amount was paid.';
  return null;
}

export interface Snapshot { cash: number; digital: number; method: string | null; refno: string | null; servedBy: number | null; servedByName?: string | null; rx?: string | null }

/** what differs between the bill as it was and as corrected, one plain phrase each (empty when nothing differs) */
export function changesOf(before: Snapshot, after: Snapshot): string[] {
  const out: string[] = [];
  if (money(before.cash) !== money(after.cash) || money(before.digital) !== money(after.digital) || (before.method || '') !== (after.method || '')) {
    const text = (s: Snapshot) => `cash ${money(s.cash).toFixed(2)}, digital ${money(s.digital).toFixed(2)}${money(s.digital) > 0 && s.method ? ` (${s.method})` : ''}`;
    out.push(`payment: ${text(before)} → ${text(after)}`);
  } else if (money(after.digital) > 0 && (before.refno || '') !== (after.refno || '')) {
    out.push('digital payment reference changed');
  }
  if ((before.servedBy ?? null) !== (after.servedBy ?? null)) out.push(`served by: ${before.servedByName || 'not named'} → ${after.servedByName || 'not named'}`);
  if ((before.rx ?? '') !== (after.rx ?? '')) out.push('prescription detail changed');
  return out;
}

/** the cash line that moves the drawer by the difference; null when the cash is the same */
export function cashAdjustment(beforeCash: number, afterCash: number): { category: 'SALE' | 'SALE_VOID'; deposit: number; withdraw: number } | null {
  const d = money(afterCash) - money(beforeCash);
  if (Math.abs(d) < 0.005) return null;
  return d > 0
    ? { category: 'SALE', deposit: money(d), withdraw: 0 }
    : { category: 'SALE_VOID', deposit: 0, withdraw: money(-d) };
}

/** the warning shown before saving, built from the facts so it always names what will really happen */
export function correctionWarnings(changes: string[], opts: { cashMoves: boolean; digitalMoves: boolean; taxInvoice: boolean }): string[] {
  const w: string[] = [];
  if (opts.cashMoves) w.push("The shift's cash is adjusted by the difference, so the cash you count at close should follow the corrected bill.");
  if (opts.digitalMoves) w.push("The digital total of this shift changes; it must match the statement.");
  if (opts.taxInvoice) w.push('The tax invoice keeps its number, lines and total.');
  if (changes.some((c) => c.startsWith('prescription'))) w.push("The drug register lines of this bill are written again with the new detail (the old lines stay on record as replaced).");
  w.push('Every change is written to the audit log with your name and the reason.');
  return w;
}

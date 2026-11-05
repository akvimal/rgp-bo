/**
 * When a completed bill may be voided (rung up by mistake): only while the shift it was rung in is still open, only if nothing
 * was returned against it, and only by the person who rang it (or serves for it) or someone who may void any bill.
 */
export interface VoidFacts {
  status: string;
  shiftId: number | null;
  shiftStatus: string | null;
  returns: number;
  isOwn: boolean;
  canVoidAny: boolean;
  /** a Business Head's force-void: the shift and "your own bill" rules do not apply (returns still stop it) */
  force?: boolean;
}

export const MIN_REASON = 3;

export function voidReasonProblem(reason: any): string | null {
  return `${reason ?? ''}`.trim().length >= MIN_REASON ? null : 'Say why the bill is being voided.';
}

/** the first thing that stops the bill being voided, in plain words; null when it may be */
export function voidProblem(f: VoidFacts): string | null {
  if (`${f.status}`.toUpperCase() === 'VOID') return 'This bill is already voided.';
  if (`${f.status}`.toUpperCase() !== 'COMPLETE') return 'Only a completed bill can be voided: a held bill is discarded instead.';
  if (f.returns > 0) return 'Something was already returned against this bill, so it cannot be voided.';
  if (f.force) return null;
  if (!f.shiftId) return 'This bill is not on a shift, so it cannot be voided. Ask a manager.';
  if (`${f.shiftStatus}`.toUpperCase() !== 'OPEN') return 'Its shift is closed: a bill can only be voided during the shift it was rung in. Use a return instead.';
  if (!f.isOwn && !f.canVoidAny) return 'You can void only the bills you rang up. Ask a manager to void this one.';
  return null;
}

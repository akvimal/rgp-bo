/**
 * Fixed reason taxonomy for stock quantity changes (WS-3,
 * docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md). Fixed in code, no settings screen — same
 * precedent as CASH_DENOMINATIONS in ../store/denominations.ts.
 *
 * USER_REASON_CODES are chosen by staff on the Adjust screen. The remaining values are written
 * by the system itself (transfer postings, the legacy audit workflow) and are not offered in the
 * UI dropdown, but share the same column so reporting can filter across both.
 */
export const USER_REASON_CODES = ['DAMAGED', 'EXPIRED', 'RETURNED_TO_VENDOR', 'SHRINKAGE', 'CORRECTION', 'OTHER', 'FOUND', 'NOT_ENTERED', 'CUSTOMER_RETURN'] as const;

/** reasons that can only take stock out (a loss), and reasons that can only put stock in (a gain); CORRECTION and OTHER can go either way */
export const REMOVE_ONLY_REASON_CODES = ['DAMAGED', 'EXPIRED', 'RETURNED_TO_VENDOR', 'SHRINKAGE'];
export const ADD_ONLY_REASON_CODES = ['FOUND', 'NOT_ENTERED', 'CUSTOMER_RETURN'];

/** a reason that does not fit the direction of the change ('' when it fits): "Damaged" with stock added, or "Found in a count" with stock removed */
export function reasonDirectionProblem(code: any, qty: any): string {
  const c = String(code || '').toUpperCase(), n = Number(qty);
  if (!Number.isFinite(n) || n === 0) return '';
  if (n > 0 && REMOVE_ONLY_REASON_CODES.includes(c)) return 'That reason is for stock that left (it was lost, damaged, expired or sent back), but this adds stock. Choose Add stock only for something found or received, or pick another reason.';
  if (n < 0 && ADD_ONLY_REASON_CODES.includes(c)) return 'That reason is for stock that came in (it was found, received or returned by a customer), but this removes stock. Choose Remove stock, or pick another reason.';
  return '';
}

export const SYSTEM_REASON_CODES = ['RETURNED', 'RETURN_DISCARD', 'TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_IN_SHORT', 'TRANSFER_CANCELLED', 'AUDIT'] as const;

/** stock that left the shelf as waste: flagged on the movement so it can be listed and reported */
export const DISCARD_REASON_CODES = ['EXPIRED', 'DAMAGED', 'RETURN_DISCARD'];
export const isDiscard = (code: any, qty: any) => Number(qty) < 0 && DISCARD_REASON_CODES.includes(String(code || '').toUpperCase());

export const ALL_REASON_CODES: string[] = [...USER_REASON_CODES, ...SYSTEM_REASON_CODES];

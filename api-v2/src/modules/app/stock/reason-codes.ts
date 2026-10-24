/**
 * Fixed reason taxonomy for stock quantity changes (WS-3,
 * docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md). Fixed in code, no settings screen — same
 * precedent as CASH_DENOMINATIONS in ../store/denominations.ts.
 *
 * USER_REASON_CODES are chosen by staff on the Adjust screen. The remaining values are written
 * by the system itself (transfer postings, the legacy audit workflow) and are not offered in the
 * UI dropdown, but share the same column so reporting can filter across both.
 */
export const USER_REASON_CODES = ['DAMAGED', 'EXPIRED', 'RETURNED_TO_VENDOR', 'SHRINKAGE', 'CORRECTION', 'OTHER'] as const;

export const SYSTEM_REASON_CODES = ['RETURNED', 'RETURN_DISCARD', 'TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_IN_SHORT', 'TRANSFER_CANCELLED', 'AUDIT'] as const;

/** stock that left the shelf as waste: flagged on the movement so it can be listed and reported */
export const DISCARD_REASON_CODES = ['EXPIRED', 'DAMAGED', 'RETURN_DISCARD'];
export const isDiscard = (code: any, qty: any) => Number(qty) < 0 && DISCARD_REASON_CODES.includes(String(code || '').toUpperCase());

export const ALL_REASON_CODES: string[] = [...USER_REASON_CODES, ...SYSTEM_REASON_CODES];

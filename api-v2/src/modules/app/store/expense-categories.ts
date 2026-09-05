/**
 * Fixed expense category taxonomy for the store cash ledger (WS-2,
 * docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md). Fixed in code, no settings screen — same
 * precedent as CASH_DENOMINATIONS in ./denominations.ts and the stock reason codes.
 */
export const EXPENSE_CATEGORIES = ['RENT', 'ELECTRICITY', 'STAFF_ADVANCE', 'CLEANING', 'MAINTENANCE', 'MISC'] as const;

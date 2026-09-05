/**
 * Fixed reason taxonomy for stock adjustments (WS-3, docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md).
 * Mirrors api-v2/src/modules/app/stock/reason-codes.ts (same fixed-in-code precedent as the
 * denomination set - kept in both places rather than shared across the FE/BE boundary).
 */
export const STOCK_ADJUSTMENT_REASONS: { value: string; label: string }[] = [
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'RETURNED_TO_VENDOR', label: 'Returned to Vendor' },
    { value: 'SHRINKAGE', label: 'Shrinkage' },
    { value: 'CORRECTION', label: 'Correction' },
    { value: 'OTHER', label: 'Other' },
];

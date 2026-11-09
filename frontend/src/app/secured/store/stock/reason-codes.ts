/**
 * Fixed reason taxonomy for stock adjustments (WS-3, docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md).
 * Mirrors api-v2/src/modules/app/stock/reason-codes.ts (same fixed-in-code precedent as the
 * denomination set - kept in both places rather than shared across the FE/BE boundary).
 *
 * An adjustment is either REMOVE (stock leaves) or ADD (stock comes in), and each direction has its own reasons, so a reason can never contradict
 * the direction. The codes stored are unchanged (older rows still read); only the words shown are plainer.
 */
export type Direction = 'REMOVE' | 'ADD';

export const REMOVE_REASONS: { value: string; label: string }[] = [
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'RETURNED_TO_VENDOR', label: 'Sent back to the vendor' },
    { value: 'SHRINKAGE', label: 'Lost or missing' },
    { value: 'CORRECTION', label: 'Correction (the book had too much)' },
    { value: 'OTHER', label: 'Other' },
];

export const ADD_REASONS: { value: string; label: string }[] = [
    { value: 'FOUND', label: 'Found in a count' },
    { value: 'NOT_ENTERED', label: 'Received but not entered' },
    { value: 'CUSTOMER_RETURN', label: 'Returned by a customer (not through billing)' },
    { value: 'CORRECTION', label: 'Correction (the book had too little)' },
    { value: 'OTHER', label: 'Other' },
];

/** every reason, once (for lists that do not know the direction) */
export const STOCK_ADJUSTMENT_REASONS: { value: string; label: string }[] =
    [...REMOVE_REASONS, ...ADD_REASONS].filter((r, i, all) => all.findIndex((x) => x.value === r.value) === i);

/** words for system-written codes too, so a list never shows a raw code */
const SYSTEM_LABELS: { [code: string]: string } = {
    RETURNED: 'Customer return (restocked)', RETURN_DISCARD: 'Customer return (discarded)', TRANSFER_OUT: 'Transfer out', TRANSFER_IN: 'Transfer in',
    TRANSFER_IN_SHORT: 'Transfer received short', TRANSFER_CANCELLED: 'Transfer cancelled', AUDIT: 'Stock count',
    CORRECTION: 'Correction', OTHER: 'Other',
};

/** the words for a stored reason code ('' for none); an unknown code is shown as it is */
export const reasonLabel = (code: any): string => {
    const c = String(code || '').toUpperCase();
    if (!c) return '';
    return SYSTEM_LABELS[c] || (STOCK_ADJUSTMENT_REASONS.find((r) => r.value === c) || { label: String(code) }).label.replace(/ \(the book had too (much|little)\)$/, '');
};

export const reasonsFor = (direction: Direction | ''): { value: string; label: string }[] =>
    direction === 'REMOVE' ? REMOVE_REASONS : direction === 'ADD' ? ADD_REASONS : [];

/** the direction of a stored quantity */
export const directionOfQty = (qty: any): Direction | '' => (Number(qty) < 0 ? 'REMOVE' : Number(qty) > 0 ? 'ADD' : '');

export interface AdjustmentPlan { signed: number; after: number; problem: string }

/** what an adjustment does: the signed quantity to send, the stock after it, and what is wrong with it ('' when nothing). `qty` is how many, always positive. */
export const adjustmentPlan = (direction: Direction | '', qty: any, balance: any): AdjustmentPlan => {
    const n = Number(qty), have = Number(balance) || 0;
    if (!direction) return { signed: 0, after: have, problem: 'Choose whether stock is being removed or added.' };
    if (!(n > 0)) return { signed: 0, after: have, problem: 'Enter how many units.' };
    if (!Number.isInteger(n)) return { signed: 0, after: have, problem: 'Enter a whole number of units.' };
    if (direction === 'REMOVE' && n > have) return { signed: 0, after: have, problem: `Only ${have} in stock, so at most ${have} can be removed.` };
    const signed = direction === 'REMOVE' ? -n : n;
    return { signed, after: have + signed, problem: '' };
};

/** reasons that need a few words of explanation before saving */
export const needsComment = (reason: string): boolean => reason === 'OTHER' || reason === 'CORRECTION';

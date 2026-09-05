/**
 * Fixed opening/closing checklist for the cashier's shift (WS-7,
 * docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md). Fixed in code, no settings screen — same
 * precedent as CASH_DENOMINATIONS in ./denominations.ts. Deliberately excludes anything
 * cold-chain-specific (out of scope, per the 2026-09-05 discussion).
 *
 * Only validated when the caller actually sends a checklist array (the POS "My Shift" card
 * always does, and requires every item ticked before it will submit) - a manager or API caller
 * that omits it entirely isn't blocked, so existing shift-management flows are unaffected.
 */
export const OPENING_CHECKLIST_KEYS = [
  'float_counted',
  'terminal_working',
  'entrance_unlocked',
  'prior_deposit_secured',
] as const;

export const CLOSING_CHECKLIST_KEYS = [
  'drawer_counted',
  'entrance_locked',
  'lights_off',
  'cash_secured',
] as const;

/** Returns an error message if the checklist is missing any required key, else null. */
export function validateChecklist(keys: readonly string[], submitted: any): string | null {
  if (!Array.isArray(submitted)) {
    return 'Complete the checklist before continuing.';
  }
  const missing = keys.filter((k) => !submitted.includes(k));
  return missing.length ? `Checklist incomplete: ${missing.join(', ')}` : null;
}

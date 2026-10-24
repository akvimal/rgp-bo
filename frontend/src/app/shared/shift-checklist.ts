/**
 * Mirrors api-v2/src/modules/app/store/shift-checklist.ts (WS-7). The server only insists on the keys it lists there;
 * the extra items below are for the person closing (expenses and digital totals checked) and are kept with the shift.
 */
export interface ChecklistItem { key: string; label: string; checked: boolean; }

export const OPENING_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: 'float_counted', label: 'Opening float counted and matches the system' },
    { key: 'terminal_working', label: 'POS terminal powered on and working' },
    { key: 'entrance_unlocked', label: 'Entrance shutter/door unlocked' },
    { key: 'prior_deposit_secured', label: "Yesterday's cash deposited or securely stored" },
];

/** End of day: the store is closing. */
export const CLOSING_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: 'drawer_counted', label: 'Drawer counted and reconciled' },
    { key: 'expenses_recorded', label: 'Every payment made from the cash drawer is recorded' },
    { key: 'digital_received', label: 'Every digital payment (UPI, card, wallet) confirmed as received' },
    { key: 'cash_secured', label: 'Cash secured in the safe/deposit bag' },
];

/** Handover: the store stays open, so securing the cash does not apply. */
export const HANDOVER_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: 'drawer_counted', label: 'Drawer counted and shown to the person taking over' },
    { key: 'expenses_recorded', label: 'Every payment made from the cash drawer is recorded' },
    { key: 'digital_received', label: 'Every digital payment (UPI, card, wallet) confirmed as received' },
];

export function freshChecklist(items: { key: string; label: string }[]): ChecklistItem[] {
    return items.map((i) => ({ ...i, checked: false }));
}

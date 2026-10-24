/**
 * Mirrors api-v2/src/modules/app/store/shift-checklist.ts (WS-7). The server only insists on the keys it lists there;
 * the extra items below are for the person closing (expenses and digital totals checked) and are kept with the shift.
 */
export interface ChecklistItem { key: string; label: string; checked: boolean; /** when it was ticked (ISO), kept with the shift */ at?: string; }

/** The first shift of the day: the store is being opened. */
export const OPENING_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: 'float_counted', label: 'Opening float counted and matches the system' },
    { key: 'previous_reconciled', label: "Yesterday's cash and digital payments reconciled, nothing left unexplained" },
    { key: 'prior_deposit_secured', label: "Yesterday's cash deposited or securely stored" },
    { key: 'entrance_unlocked', label: 'Entrance shutter/door unlocked' },
    { key: 'terminal_working', label: 'POS terminal and bill printer powered on and working' },
    { key: 'digital_machine_ready', label: 'Card / UPI machine charged, connected and working' },
];

/** A shift taken up while the store is already open (a handover, a later shift, a second person): the door and the deposit are done. */
export const OPENING_OPEN_STORE_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: 'float_counted', label: 'Drawer counted and matches what the last shift left' },
    { key: 'previous_reconciled', label: "The last shift's cash and digital payments reconciled, nothing left unexplained" },
    { key: 'signed_in', label: 'Signed in to the POS under my own name' },
    { key: 'digital_machine_ready', label: 'Card / UPI machine charged and working' },
    { key: 'handover_notes', label: 'Handover notes read: held bills, pending deliveries, customer requests' },
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

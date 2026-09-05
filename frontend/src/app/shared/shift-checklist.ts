/** Mirrors api-v2/src/modules/app/store/shift-checklist.ts (WS-7). */
export interface ChecklistItem { key: string; label: string; checked: boolean; }

export const OPENING_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: 'float_counted', label: 'Opening float counted and matches the system' },
    { key: 'terminal_working', label: 'POS terminal powered on and working' },
    { key: 'entrance_unlocked', label: 'Entrance shutter/door unlocked' },
    { key: 'prior_deposit_secured', label: "Yesterday's cash deposited or securely stored" },
];

export const CLOSING_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: 'drawer_counted', label: 'Drawer counted and reconciled' },
    { key: 'entrance_locked', label: 'Entrance shutter/door locked' },
    { key: 'lights_off', label: 'Lights and AC turned off' },
    { key: 'cash_secured', label: 'Cash secured in the safe/deposit bag' },
];

export function freshChecklist(items: { key: string; label: string }[]): ChecklistItem[] {
    return items.map((i) => ({ ...i, checked: false }));
}

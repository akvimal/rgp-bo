import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';

/**
 * The checklists a person ticks when a shift is opened, handed over or closed (WS-7, docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md).
 *
 * There are four lists, because the work differs:
 *   OPENING             the first shift of the day: the store is being opened
 *   OPENING_OPEN_STORE  a shift taken up while the store is already open (a handover, a later shift, a second person)
 *   CLOSING             the end of the day
 *   HANDOVER            a close that passes the drawer to the next person while the store stays open
 *
 * Each list is the business's own when it has written one, with an optional list of its own for a store; the lists below are what
 * is used until then. The page makes the person tick every item. The server insists only on the CORE keys that are still on the
 * list in force - the counts that matter to the cash - so an API caller is not asked to know a business's wording.
 */
export type ChecklistKind = 'OPENING' | 'OPENING_OPEN_STORE' | 'CLOSING' | 'HANDOVER';
export interface ChecklistItem { key: string; label: string; }

export const CHECKLIST_KINDS: ChecklistKind[] = ['OPENING', 'OPENING_OPEN_STORE', 'CLOSING', 'HANDOVER'];

export const DEFAULT_CHECKLISTS: { [k in ChecklistKind]: ChecklistItem[] } = {
  OPENING: [
    { key: 'float_counted', label: 'Opening float counted and matches the system' },
    { key: 'previous_reconciled', label: "Yesterday's cash and digital payments reconciled, nothing left unexplained" },
    { key: 'prior_deposit_secured', label: "Yesterday's cash deposited or securely stored" },
    { key: 'entrance_unlocked', label: 'Entrance shutter/door unlocked' },
    { key: 'terminal_working', label: 'POS terminal and bill printer powered on and working' },
    { key: 'digital_machine_ready', label: 'Card / UPI machine charged, connected and working' },
  ],
  OPENING_OPEN_STORE: [
    { key: 'float_counted', label: 'Drawer counted and matches what the last shift left' },
    { key: 'previous_reconciled', label: "The last shift's cash and digital payments reconciled, nothing left unexplained" },
    { key: 'signed_in', label: 'Signed in to the POS under my own name' },
    { key: 'digital_machine_ready', label: 'Card / UPI machine charged and working' },
    { key: 'handover_notes', label: 'Handover notes read: held bills, pending deliveries, customer requests' },
  ],
  CLOSING: [
    { key: 'drawer_counted', label: 'Drawer counted and reconciled' },
    { key: 'expenses_recorded', label: 'Every payment made from the cash drawer is recorded' },
    { key: 'digital_received', label: 'Every digital payment (UPI, card, wallet) confirmed as received' },
    { key: 'cash_secured', label: 'Cash secured in the safe/deposit bag' },
  ],
  HANDOVER: [
    { key: 'drawer_counted', label: 'Drawer counted and shown to the person taking over' },
    { key: 'expenses_recorded', label: 'Every payment made from the cash drawer is recorded' },
    { key: 'digital_received', label: 'Every digital payment (UPI, card, wallet) confirmed as received' },
  ],
};

/** the keys the server insists on, where they are still on the list in force */
export const CORE_CHECKLIST_KEYS: { [k in ChecklistKind]: string[] } = {
  OPENING: ['float_counted'],
  OPENING_OPEN_STORE: ['float_counted'],
  CLOSING: ['drawer_counted', 'cash_secured'],
  HANDOVER: ['drawer_counted'],
};

export const isChecklistKind = (k: any): k is ChecklistKind => CHECKLIST_KINDS.includes(k);

/** the list in force for a store: its own, else its business's, else the standard one; and where it came from */
export async function effectiveChecklist(manager: EntityManager, storeId: number, kind: ChecklistKind): Promise<{ items: ChecklistItem[]; source: 'store' | 'business' | 'default' }> {
  const [store] = await manager.query(`select business_id from stores where id = $1`, [storeId]);
  const rows = await manager.query(
    `select store_id, items from shift_checklist where kind = $2 and ((store_id = $1) or (store_id is null and business_id = $3))`,
    [storeId, kind, store?.business_id ?? 0]);
  const own = rows.find((r: any) => r.store_id !== null && +r.store_id === +storeId);
  if (own) return { items: own.items as ChecklistItem[], source: 'store' };
  const biz = rows.find((r: any) => r.store_id === null);
  if (biz) return { items: biz.items as ChecklistItem[], source: 'business' };
  return { items: DEFAULT_CHECKLISTS[kind], source: 'default' };
}

/** the keys that must be ticked: the core ones that are still on the store's list */
export async function requiredChecklistKeys(manager: EntityManager, storeId: number, kind: ChecklistKind): Promise<string[]> {
  const { items } = await effectiveChecklist(manager, storeId, kind);
  return CORE_CHECKLIST_KEYS[kind].filter((k) => items.some((i) => i.key === k));
}

/** what a person wrote for a list, checked and tidied; a new item gets a key of its own */
export function normalizeChecklistItems(raw: any): ChecklistItem[] {
  if (!Array.isArray(raw)) throw new BadRequestException('The items must be a list.');
  if (raw.length > 15) throw new BadRequestException('A checklist can have at most 15 items.');
  const keys = new Set<string>();
  const labels = new Set<string>();
  return raw.map((it: any, i: number) => {
    const label = String(it?.label ?? '').replace(/\s+/g, ' ').trim();
    if (label.length < 3 || label.length > 120) throw new BadRequestException(`Item ${i + 1}: write between 3 and 120 characters.`);
    if (labels.has(label.toLowerCase())) throw new BadRequestException(`"${label}" is on the list twice.`);
    labels.add(label.toLowerCase());
    let key = String(it?.key ?? '');
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || keys.has(key)) key = 'c_' + randomBytes(3).toString('hex');
    keys.add(key);
    return { key, label };
  });
}

/** Returns an error message if the checklist is missing any required key, else null. */
export function validateChecklist(keys: readonly string[], submitted: any): string | null {
  if (!Array.isArray(submitted)) {
    return 'Complete the checklist before continuing.';
  }
  const missing = keys.filter((k) => !submitted.includes(k));
  return missing.length ? `Checklist incomplete: ${missing.join(', ')}` : null;
}

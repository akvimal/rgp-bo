/**
 * What a delivery cost and how it was paid: the rules for turning "paid in cash from the counter" or "paid digitally" into one entry on the right ledger,
 * once, and for changing or taking it back later. Pure, so tested without a database. See docs/planning/DELIVERY_MANAGE.md.
 */

export const COST_VIA = ['CASH', 'DIGITAL', 'UNPAID', 'NONE'] as const;
export type CostVia = (typeof COST_VIA)[number];
/** how a digital payment is recorded (the Expenses ledger's payment modes, less cash) */
export const DIGITAL_MODES = ['UPI', 'BANK', 'CARD', 'CHEQUE'] as const;
/** the category the cost goes under: in the cash drawer ledger, and in the Expenses ledger */
export const CASH_EXPENSE_CATEGORY = 'LOGISTICS';
export const EXPENSE_CATEGORY_NAME = 'Transport and courier';

/** an entry that was already there (an expense entered separately, before this) and is being linked to the delivery instead of posting a new one */
export interface CostLink { kind: 'CASH' | 'DIGITAL'; id: number }
/** shiftId: for cash, the open shift whose drawer pays (a Store Head or above choosing one; null = the person's own) */
export interface CostRequest { via: CostVia; mode: string | null; ref: string | null; amount: number; link: CostLink | null; shiftId: number | null }

const text = (v: any, max: number): string | null => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

/** the request from the screen, checked; `via` undefined means the cost is not being touched */
export const cleanCostRequest = (raw: any, amount: any): { ok: true; req: CostRequest | null } | { ok: false; message: string } => {
  if (!raw || ((raw.via === undefined || raw.via === null || raw.via === '') && (raw.link === undefined || raw.link === null))) return { ok: true, req: null };
  // linking to an entry that is already there: its kind decides the way, and its own amount and mode are the ones that count
  if (raw.link !== undefined && raw.link !== null) {
    const kind = String(raw.link.kind ?? '').toUpperCase();
    const id = Number(raw.link.id);
    if (kind !== 'CASH' && kind !== 'DIGITAL') return { ok: false, message: 'Say whether the entry to link is a cash entry or an expense.' };
    if (!Number.isInteger(id) || id <= 0) return { ok: false, message: 'Choose the entry to link.' };
    const n = Math.round((Number(amount) || 0) * 100) / 100;
    return { ok: true, req: { via: kind, mode: null, ref: null, amount: n >= 0 ? n : 0, link: { kind, id }, shiftId: null } };
  }
  const via = String(raw.via).toUpperCase();
  if (!(COST_VIA as readonly string[]).includes(via)) return { ok: false, message: 'Choose how the delivery cost was paid: cash from the counter, digital, not paid yet, or no cost.' };
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  if (!(n >= 0)) return { ok: false, message: 'The cost cannot be negative.' };
  if (n > 1000000) return { ok: false, message: 'That cost is too large to be right.' };
  if ((via === 'CASH' || via === 'DIGITAL') && !(n > 0)) return { ok: false, message: 'Enter the cost before saying how it was paid.' };
  let mode: string | null = null;
  if (via === 'DIGITAL') {
    mode = String(raw.mode ?? '').toUpperCase();
    if (!(DIGITAL_MODES as readonly string[]).includes(mode)) return { ok: false, message: 'Choose how it was paid: UPI, bank transfer, card or cheque.' };
  }
  const shift = Number(raw.shiftid);
  const shiftId = via === 'CASH' && Number.isInteger(shift) && shift > 0 ? shift : null;
  return { ok: true, req: { via: via as CostVia, mode, ref: via === 'DIGITAL' ? text(raw.ref, 60) : null, amount: via === 'NONE' ? 0 : n, link: null, shiftId } };
};

/** what the delivery already has: the entry it made, and whether that entry can still be changed or taken back */
export interface CostState {
  via: string | null;
  amount: number | null;
  mode: string | null;
  cashEntryId: number | null;
  expenseId: number | null;
  /** a cash entry can change while its shift is open */
  cashEditable: boolean;
  /** an expense can change while it is still pending (not yet approved) */
  expenseEditable: boolean;
  /** the entry was already there and was linked: it is never changed or deleted from the delivery, only unlinked */
  linked: boolean;
}

export type CostStep =
  | { do: 'none' }
  /** take back what the delivery posted (delete it), or, for a linked entry, only let go of it */
  | { do: 'reverse'; kind: 'CASH' | 'DIGITAL'; unlinkOnly: boolean }
  | { do: 'post'; via: 'CASH' | 'DIGITAL' }
  | { do: 'update'; via: 'CASH' | 'DIGITAL' }
  | { do: 'link'; kind: 'CASH' | 'DIGITAL'; id: number }
  | { do: 'refuse'; message: string };

export const LOCKED_CASH = 'The cash for this delivery was counted in a shift that is now closed. Correct it on the Cash screen, not here.';
export const LOCKED_DIGITAL = 'This payment was already approved as an expense. Correct it on the Expenses screen, not here.';
export const LINKED_MESSAGE = 'This cost is linked to an expense that was already recorded. Change the expense there, or unlink it here first.';

const money = (a: number | null, b: number | null) => Math.abs((a ?? 0) - (b ?? 0)) < 0.005;

/**
 * The steps to take: nothing, take back what was posted (or only let go of a linked entry), post a new entry, link one that is already there, change the
 * one already posted, or refuse. Nothing is posted twice, an entry that can no longer be changed (a closed shift, an approved expense) is never silently
 * altered, and an entry that was linked is never changed or deleted from the delivery.
 */
export const planCost = (state: CostState, req: CostRequest | null): CostStep[] => {
  if (!req) return [{ do: 'none' }];
  const kind: 'CASH' | 'DIGITAL' | null = state.cashEntryId ? 'CASH' : state.expenseId ? 'DIGITAL' : null;
  const editable = kind === 'CASH' ? state.cashEditable : kind === 'DIGITAL' ? state.expenseEditable : true;
  const lockedMessage = kind === 'CASH' ? LOCKED_CASH : LOCKED_DIGITAL;
  /** getting rid of what is there: a linked entry is only let go; one the delivery posted is taken back while it can be */
  const undo = (): CostStep[] =>
    !kind ? [] : state.linked ? [{ do: 'reverse', kind, unlinkOnly: true }] : editable ? [{ do: 'reverse', kind, unlinkOnly: false }] : [{ do: 'refuse', message: lockedMessage }];
  const refused = (steps: CostStep[]) => steps.some((x) => x.do === 'refuse');

  if (req.link) {
    const sameEntry = (req.link.kind === 'CASH' && state.cashEntryId === req.link.id) || (req.link.kind === 'DIGITAL' && state.expenseId === req.link.id);
    if (sameEntry) return [{ do: 'none' }];
    const gone = undo();
    return refused(gone) ? gone : [...gone, { do: 'link', kind: req.link.kind, id: req.link.id }];
  }
  if (req.via === 'UNPAID' || req.via === 'NONE') {
    return kind ? undo() : [{ do: 'none' }];
  }
  if (kind === req.via) {
    const same = money(state.amount, req.amount) && (req.via === 'CASH' || (state.mode ?? '') === (req.mode ?? ''));
    if (same) return [{ do: 'none' }];
    if (state.linked) return [{ do: 'refuse', message: LINKED_MESSAGE }];
    return editable ? [{ do: 'update', via: req.via }] : [{ do: 'refuse', message: lockedMessage }];
  }
  if (kind) {
    const gone = undo();
    return refused(gone) ? gone : [...gone, { do: 'post', via: req.via }];
  }
  return [{ do: 'post', via: req.via }];
};

/** the words on the ledger entry */
export const costDescription = (billNo: string | number | null, receiver: string | null, by: string | null): string => {
  const parts = [`Delivery #${billNo ?? '?'}`];
  if (receiver && receiver.trim()) parts.push(`to ${receiver.trim()}`);
  if (by && by.trim()) parts.push(`by ${by.trim()}`);
  return parts.join(' ').slice(0, 200);
};

/** the label for the list ("Paid in cash", "Cost unpaid", ...) */
export const costLabel = (via: string | null | undefined): string =>
  via === 'CASH' ? 'Paid in cash' : via === 'DIGITAL' ? 'Paid digitally' : via === 'UNPAID' ? 'Cost unpaid' : via === 'NONE' ? 'No cost' : '';

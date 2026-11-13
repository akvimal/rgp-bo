/**
 * Customer commitments: an order taken at the counter for a product the store does not have, paid in full or in part in advance. These are the rules that
 * need no database, so they can be tested alone: what an advance must say, the balance, which lines a received quantity covers, the status, the hold.
 */
export const COMMITMENT_STATUSES = ['OPEN', 'ORDERED', 'READY', 'COLLECTED', 'CANCELLED'] as const;
export type CommitmentStatus = typeof COMMITMENT_STATUSES[number];
export const DIGITAL_METHODS = ['UPI', 'Card', 'Wallet', 'Other'] as const;
export const DEFAULT_HOLD_DAYS = 7;

const money = (n: number) => Math.round(n * 100) / 100;

export interface Advance { amount: number; mode: 'CASH' | 'DIGITAL'; digimethod: string | null; digirefno: string | null }

/** what a payment (an advance, or a refund paid out) must say: an amount, cash or digital, and for digital how and (optionally) the last digits of the transaction id */
export function cleanAdvance(b: any): { ok: true; value: Advance } | { ok: false; message: string } {
  const amount = money(Number(b?.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Enter the amount.' };
  const mode = String(b?.mode || '').trim().toUpperCase();
  if (mode !== 'CASH' && mode !== 'DIGITAL') return { ok: false, message: 'Say whether it was cash or digital (UPI / card).' };
  if (mode === 'CASH') return { ok: true, value: { amount, mode, digimethod: null, digirefno: null } };
  const method = (DIGITAL_METHODS as readonly string[]).find(m => m.toLowerCase() === String(b?.digimethod || '').trim().toLowerCase());
  if (!method) return { ok: false, message: `Choose how it was paid: ${DIGITAL_METHODS.join(', ')}.` };
  const ref = String(b?.digirefno || '').toUpperCase().replace(/\s+/g, '');
  if (ref && !/^[A-Z0-9][A-Z0-9\-_/]{3,39}$/.test(ref)) return { ok: false, message: 'Enter the last 4 digits of the transaction id, or leave it blank.' };
  return { ok: true, value: { amount, mode, digimethod: method, digirefno: ref || null } };
}

/** the advance held: receipts and reversals less refunds and what bills used */
export function balanceOf(payments: { amount: number | string }[]): number {
  return money(payments.reduce((t, p) => t + Number(p.amount || 0), 0));
}

export interface LineInput { productid?: number | null; requestedname?: string | null; qty: number; agreedprice?: number | null }

/** the lines of a new commitment: a product (or the name of one not in the list yet), a whole number of packs, an optional price */
export function cleanLines(raw: any): { ok: true; value: LineInput[] } | { ok: false; message: string } {
  if (!Array.isArray(raw) || !raw.length) return { ok: false, message: 'Add at least one product.' };
  const out: LineInput[] = [];
  for (const l of raw) {
    const productid = l?.productid ? Number(l.productid) : null;
    const requestedname = String(l?.requestedname || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
    const qty = Number(l?.qty);
    if (!productid && !requestedname) return { ok: false, message: 'Choose the product, or type its name if it is not in the list.' };
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, message: 'The quantity must be a whole number of at least 1.' };
    const price = l?.agreedprice === undefined || l?.agreedprice === null || l?.agreedprice === '' ? null : money(Number(l.agreedprice));
    if (price !== null && (!Number.isFinite(price) || price < 0)) return { ok: false, message: 'The price must be zero or more.' };
    out.push({ productid, requestedname: productid ? null : requestedname, qty, agreedprice: price });
  }
  return { ok: true, value: out };
}

/** what the customer agreed to pay for the lines (a line with no price yet counts as nothing) */
export function totalOf(lines: { qty: number; agreed_price?: number | string | null }[]): number {
  return money(lines.reduce((t, l) => t + Number(l.qty || 0) * Number(l.agreed_price || 0), 0));
}

/**
 * A received quantity covers the lines that wait for it, the oldest commitment first. The lines come in that order; each takes what it needs
 * until the received quantity runs out. Worked out again each time from what was received, so a deleted invoice takes it back.
 */
export function allocateReceived<T extends { id: number; qty: number }>(lines: T[], received: number): Map<number, number> {
  let left = Math.max(0, Math.floor(Number(received) || 0));
  const out = new Map<number, number>();
  for (const l of lines) {
    const take = Math.min(left, l.qty);
    out.set(l.id, take);
    left -= take;
  }
  return out;
}

/** where a commitment stands, from its lines: something arrived (ready), something is on a purchase request (ordered), or neither (open). Collected and cancelled stay. */
export function statusOf(current: string, lines: { request_id?: number | null; qty_received?: number | null }[]): CommitmentStatus {
  if (current === 'COLLECTED' || current === 'CANCELLED') return current;
  if (lines.some(l => Number(l.qty_received || 0) > 0)) return 'READY';
  if (lines.some(l => l.request_id)) return 'ORDERED';
  return 'OPEN';
}

/** the day the hold on received goods ends */
export function holdUntil(today: string, days: number): string {
  const n = Number.isFinite(days) && days >= 0 ? Math.floor(days) : DEFAULT_HOLD_DAYS;
  return new Date(Date.parse(today + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

/** whether the received goods are still held for the customer on a day */
export function stillHeld(hold: string | null | undefined, today: string): boolean {
  return !!hold && String(hold).slice(0, 10) >= today;
}

/** a refund cannot be more than what is held; a commitment already collected has nothing to refund */
export function refundProblem(status: string, balance: number, amount: number): string | null {
  if (status === 'COLLECTED') return 'This commitment was collected; there is nothing to refund.';
  if (!(amount > 0)) return 'Enter the amount.';
  if (amount > balance + 0.005) return `Only ${balance.toFixed(2)} is held for this commitment.`;
  return null;
}

/** units a customer's lines hold: packs received (still to be collected) times the product's pack */
export function heldUnits(qtyReceived: number, pack: number | null | undefined): number {
  return Math.max(0, Math.floor(Number(qtyReceived) || 0)) * Math.max(1, Number(pack) || 1);
}

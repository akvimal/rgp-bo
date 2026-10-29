/**
 * The tax on a bill, rate by rate, and the numbers of tax documents. Pure rules, no database.
 * A bill line's total includes GST, so the tax inside it is worked out backwards; an invoice-level discount reduces every rate's taxable value in
 * proportion; CGST and SGST are half each (the odd paisa to SGST) within the state, and the whole tax is IGST between states.
 */

export interface TaxLine { total: number; rate: number }

export interface RateRow {
  rate: number;
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: any) => Number(v) || 0;

/** CGST/SGST of one tax amount: half each, the odd paisa to SGST */
export function halves(tax: number): { cgst: number; sgst: number } {
  const cgst = Math.floor(r2(tax) * 100 / 2) / 100;
  return { cgst, sgst: r2(tax - cgst) };
}

export function splitBill(lines: TaxLine[], discount: number, interState: boolean): RateRow[] {
  const groups = new Map<number, number>();
  for (const l of lines) groups.set(num(l.rate), (groups.get(num(l.rate)) || 0) + num(l.total));
  const rates = Array.from(groups.keys()).sort((a, b) => a - b);
  const sum = rates.reduce((t, r) => t + (groups.get(r) || 0), 0);
  const disc = Math.max(0, Math.min(num(discount), sum));
  let left = r2(disc);
  return rates.map((rate, i) => {
    const gross = r2(groups.get(rate) || 0);
    const share = i === rates.length - 1 ? left : Math.min(left, r2(sum > 0 ? disc * gross / sum : 0));
    left = r2(left - share);
    const net = r2(gross - share);
    const taxable = r2(net / (1 + rate / 100));
    const tax = r2(net - taxable);
    const h = interState ? { cgst: 0, sgst: 0 } : halves(tax);
    return { rate, gross, discount: share, taxable, tax, cgst: h.cgst, sgst: h.sgst, igst: interState ? tax : 0 };
  });
}

/** the financial year of a date ('YYYY-MM-DD' or a Date) as '25-26' (April to March) */
export function fyLabel(d: string | Date): string {
  const s = typeof d === 'string' ? d.slice(0, 10) : new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
  const y = +s.slice(0, 4), m = +s.slice(5, 7);
  const start = m >= 4 ? y : y - 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(start)}-${yy(start + 1)}`;
}

/** the first and last day of the financial year that holds a date */
export function fyBounds(d: string): { from: string; to: string } {
  const y = +d.slice(0, 4), m = +d.slice(5, 7);
  const start = m >= 4 ? y : y - 1;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

const pad = (n: number) => String(n).padStart(6, '0');
/** at most 16 characters: letters, digits, '/' and '-' only */
export const invoiceNo = (prefix: string, fy: string, n: number) => `${prefix}/${fy}/${pad(n)}`;
export const creditNoteNo = (fy: string, n: number) => `CN/${fy}/${pad(n)}`;

export const stateOfGstin = (g?: string | null) => String(g ?? '').trim().slice(0, 2);

/** the supply crosses a state border: the place of supply is not the seller's state */
export function isInterState(placeOfSupply?: string | null, sellerState?: string | null): boolean {
  const p = String(placeOfSupply ?? '').trim(), s = String(sellerState ?? '').trim();
  return !!p && !!s && p !== s;
}

/** the credit note for a returned quantity of a bill line, at the line's own rate (the bill's discount follows the line in proportion) */
export function creditFor(lineTotal: number, lineQty: number, returnedQty: number, rate: number, billLinesTotal: number, billDiscount: number) {
  const unit = lineQty > 0 ? num(lineTotal) / lineQty : 0;
  const keep = billLinesTotal > 0 ? 1 - Math.min(num(billDiscount), billLinesTotal) / billLinesTotal : 1;
  const gross = r2(unit * num(returnedQty) * keep);
  const taxable = r2(gross / (1 + num(rate) / 100));
  return { gross, taxable, tax: r2(gross - taxable) };
}

/** a prefix as the Business Head types it: 2 or 3 letters or digits (a tax invoice number is at most 16 characters) */
export function parsePrefix(v: any): { value?: string; error?: string } {
  const s = String(v ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(s)) return { error: 'The invoice prefix is 2 or 3 letters or digits.' };
  return { value: s };
}

/**
 * The month's sales, line by line, with each line's share of the bill's GST. Pure: no framework, no database.
 *
 * A bill's tax is worked out per rate (gst-tax.ts splitBill): the bill discount is shared over the rates, and the tax of each rate is rounded once. A line's share
 * of that is allocated here in proportion to its gross, the last line of the rate taking the paisa left, so the lines of a rate add up exactly to what the
 * sales report shows for it.
 */
import { splitBill } from './gst-tax';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface ItemLine { product: string; hsn: string | null; batch: string | null; qty: number; price: number; gross: number; rate: number }
export interface ItemBill { id: number; docNo: string; date: string; customer: string; buyerGstin: string | null; store: string | null; inter: boolean; discount: number; kind: 'TAX' | 'CASH'; lines: ItemLine[] }

export interface ItemRow {
  type: 'Tax invoice' | 'Cash memo';
  doc_no: string; date: string; customer: string; buyer_gstin: string | null; store: string | null;
  product: string; hsn: string | null; batch: string | null; qty: number; price: number; rate: number;
  gross: number;
  /** the bill's discount that falls on this line (tax invoices only) */
  discount: number | null;
  taxable: number | null; cgst: number | null; sgst: number | null; igst: number | null;
  /** what the customer paid for the line: gross less its discount */
  net: number;
}

/** share `total` over the weights in proportion, rounded to paise, the last taking what is left */
export function share(total: number, weights: number[]): number[] {
  const sum = weights.reduce((t, w) => t + w, 0);
  let left = r2(total);
  return weights.map((w, i) => {
    const v = i === weights.length - 1 ? left : Math.min(left, r2(sum > 0 ? (total * w) / sum : 0));
    left = r2(left - v);
    return v;
  });
}

/** every line of a bill with its share of the discount and tax. A cash memo has no tax split: its lines carry the gross only. */
export function itemRows(bill: ItemBill): ItemRow[] {
  const base = (l: ItemLine) => ({
    doc_no: bill.docNo, date: bill.date, customer: bill.customer, buyer_gstin: bill.buyerGstin, store: bill.store,
    product: l.product, hsn: l.hsn, batch: l.batch, qty: l.qty, price: r2(l.price), rate: l.rate, gross: r2(l.gross),
  });
  if (bill.kind === 'CASH') {
    return bill.lines.map((l) => ({ type: 'Cash memo' as const, ...base(l), discount: null, taxable: null, cgst: null, sgst: null, igst: null, net: r2(l.gross) }));
  }
  const groups = splitBill(bill.lines.map((l) => ({ total: l.gross, rate: l.rate })), bill.discount, bill.inter);
  const out: ItemRow[] = [];
  for (const l of bill.lines) out.push({ type: 'Tax invoice', ...base(l), discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, net: 0 });
  for (const g of groups) {
    const idx = bill.lines.map((l, i) => (l.rate === g.rate ? i : -1)).filter((i) => i >= 0);
    const w = idx.map((i) => bill.lines[i].gross);
    const d = share(g.discount, w), tx = share(g.taxable, w), c = share(g.cgst, w), s = share(g.sgst, w), ig = share(g.igst, w);
    idx.forEach((i, k) => {
      out[i].discount = d[k]; out[i].taxable = tx[k]; out[i].cgst = c[k]; out[i].sgst = s[k]; out[i].igst = ig[k];
      out[i].net = r2(bill.lines[i].gross - d[k]);
    });
  }
  return out;
}

/** the totals of a list of item rows */
export function itemTotals(rows: ItemRow[]) {
  const sum = (f: (r: ItemRow) => number | null) => r2(rows.reduce((t, r) => t + (f(r) ?? 0), 0));
  return { lines: rows.length, qty: rows.reduce((t, r) => t + r.qty, 0), gross: sum((r) => r.gross), discount: sum((r) => r.discount), taxable: sum((r) => r.taxable), cgst: sum((r) => r.cgst), sgst: sum((r) => r.sgst), igst: sum((r) => r.igst), net: sum((r) => r.net) };
}

/**
 * The earlier purchases of a product, for the history dialog on an invoice line. Pure, so tested without a database.
 * The rate on a line is the printed rate per pack; the net rate is that rate less the line's discount, which is what a price is compared on
 * (the same as the "Vs last" column).
 */
import { netRate } from './price-rules';

/** at most this many earlier purchases are returned */
export const HISTORY_LIMIT = 100;

export interface HistoryRow {
  id: number;
  invoice_date: string | null;
  invoice_no: string | null;
  challan_no: string | null;
  vendor_id: number | null;
  vendor: string | null;
  batch: string | null;
  exp_date: string | null;
  qty: number | null;
  free_qty: number | null;
  mrp_cost: number | null;
  ptr_value: number | null;
  disc_pcnt: number | null;
  tax_pcnt: number | null;
}

export interface HistoryLine extends HistoryRow {
  /** the document that carries the purchase: the vendor's invoice number, else the challan's (a goods-received note before the invoice arrives) */
  doc_no: string | null;
  net_rate: number | null;
  /** bought from the vendor of the invoice being looked at */
  same_vendor: boolean;
}

export const toHistoryLine = (r: HistoryRow, currentVendorId: number | null): HistoryLine => ({
  ...r,
  doc_no: r.invoice_no || r.challan_no || null,
  net_rate: r.ptr_value === null || r.ptr_value === undefined ? null : netRate(r.ptr_value, r.disc_pcnt),
  same_vendor: currentVendorId !== null && r.vendor_id !== null && Number(r.vendor_id) === Number(currentVendorId),
});

/** the last net rate paid, the lowest and the highest, with who and when: a few words above the table */
export const summariseHistory = (lines: HistoryLine[]) => {
  const priced = lines.filter((l) => l.net_rate !== null && l.net_rate > 0);
  if (!priced.length) return { count: lines.length, last: null, lowest: null, highest: null };
  const pick = (l: HistoryLine) => ({ rate: l.net_rate as number, vendor: l.vendor, date: l.invoice_date });
  const lowest = priced.reduce((m, l) => ((l.net_rate as number) < (m.net_rate as number) ? l : m));
  const highest = priced.reduce((m, l) => ((l.net_rate as number) > (m.net_rate as number) ? l : m));
  return { count: lines.length, last: pick(priced[0]), lowest: pick(lowest), highest: pick(highest) };   // the lines come newest first
};

/**
 * The monthly sales report (docs/planning/GST_SALES_REPORT.md): the month's supplies in the order a return is keyed. Pure: no framework, no database.
 *
 *  A. outward supplies by rate     B. returns (credit notes) by rate and the net     C. B2B and B2C, in-state and out-of-state, by rate
 *  D. nil-rated, exempt and non-GST (the 0% supplies by kind)     E. tie-out of the tax figures to the bills' totals     F. the documents issued
 */
import { RateTotals, netByRate, sumTotals } from './gst-register';
import { halves, splitBill } from './gst-tax';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type SupplyKind = 'NIL_RATED' | 'EXEMPT' | 'NON_GST';
export const SUPPLY_KINDS: SupplyKind[] = ['NIL_RATED', 'EXEMPT', 'NON_GST'];
export const KIND_LABEL: Record<SupplyKind, string> = { NIL_RATED: 'Nil-rated', EXEMPT: 'Exempt', NON_GST: 'Non-GST' };

export const asKind = (v: any): SupplyKind | null => (SUPPLY_KINDS.includes(String(v ?? '').toUpperCase() as SupplyKind) ? (String(v).toUpperCase() as SupplyKind) : null);

/** the kind of a 0% line: the product's own, else its category's default, else nil-rated. A line above 0% is taxable whatever is stored. */
export function kindOf(productKind: any, categoryKind: any): SupplyKind {
  return asKind(productKind) || asKind(categoryKind) || 'NIL_RATED';
}

export type Buyer = 'B2B' | 'B2C';
export type Place = 'INTRA' | 'INTER';

export interface ReportLine { total: number; rate: number; kind: SupplyKind }
export interface ReportBill { total: number; discount: number; lines: ReportLine[]; buyerGstin: string | null; inter: boolean; docNo: string }
export interface ReportNote { rate: number; taxable: number; tax: number; gross: number; kind: SupplyKind; buyerGstin: string | null; inter: boolean }

export interface Row extends RateTotals { total: number }
const withTotal = (r: RateTotals): Row => ({ ...r, total: r2(r.taxable + r.tax) });

const buyerOf = (g: string | null): Buyer => (String(g ?? '').trim() ? 'B2B' : 'B2C');
const placeOf = (inter: boolean): Place => (inter ? 'INTER' : 'INTRA');

/** share a 0% row's value over its kinds in proportion to the lines' gross; the last kind takes the paisa left */
function byKind(lines: ReportLine[], value: number): Array<{ kind: SupplyKind; value: number }> {
  const gross = new Map<SupplyKind, number>();
  for (const l of lines) if (l.rate === 0) gross.set(l.kind, (gross.get(l.kind) || 0) + l.total);
  const kinds = SUPPLY_KINDS.filter((k) => gross.has(k));
  const sum = kinds.reduce((t, k) => t + (gross.get(k) || 0), 0);
  let left = r2(value);
  return kinds.map((k, i) => {
    const v = i === kinds.length - 1 ? left : Math.min(left, r2(sum > 0 ? (value * (gross.get(k) || 0)) / sum : 0));
    left = r2(left - v);
    return { kind: k, value: v };
  });
}

const add = (m: Map<string, any>, key: string, init: any, f: (c: any) => void) => { const c = m.get(key) || init; f(c); m.set(key, c); };

export function buildSalesReport(input: {
  bills: ReportBill[];
  notes: ReportNote[];
  cashReturns: { count: number; amount: number };
  cancelled: string[];
  gaps: string[];
}) {
  const inv: RateTotals[] = [];
  const crd: RateTotals[] = [];
  const buckets = new Map<string, any>();      // C: buyer | place | rate
  const nil = new Map<string, any>();          // D: kind | buyer | place
  let billsTotal = 0, taxPlusTaxable = 0;

  for (const b of input.bills) {
    const rows = splitBill(b.lines.map((l) => ({ total: l.total, rate: l.rate })), b.discount, b.inter);
    billsTotal += b.total;
    const buyer = buyerOf(b.buyerGstin), place = placeOf(b.inter);
    for (const r of rows) {
      taxPlusTaxable += r.taxable + r.tax;
      inv.push({ rate: r.rate, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, tax: r.tax });
      add(buckets, `${buyer}|${place}|${r.rate}`, { buyer, place, rate: r.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }, (c) => {
        c.taxable += r.taxable; c.cgst += r.cgst; c.sgst += r.sgst; c.igst += r.igst; c.tax += r.tax;
      });
      if (r.rate === 0) {
        for (const k of byKind(b.lines, r.taxable)) {
          add(nil, `${k.kind}|${buyer}|${place}`, { kind: k.kind, buyer, place, supplied: 0, returned: 0 }, (c) => { c.supplied += k.value; });
        }
      }
    }
  }
  for (const n of input.notes) {
    const h = n.inter ? { cgst: 0, sgst: 0 } : halves(n.tax);
    crd.push({ rate: n.rate, taxable: n.taxable, cgst: h.cgst, sgst: h.sgst, igst: n.inter ? n.tax : 0, tax: n.tax });
    if (n.rate === 0) {
      const buyer = buyerOf(n.buyerGstin), place = placeOf(n.inter);
      add(nil, `${n.kind}|${buyer}|${place}`, { kind: n.kind, buyer, place, supplied: 0, returned: 0 }, (c) => { c.returned += n.taxable; });
    }
  }

  const supplies = netByRate(inv, []);
  const returnsByRate = netByRate(crd, []);            // credit notes shown as positive amounts
  const net = netByRate(inv, crd);

  const roundOff = r2(billsTotal - taxPlusTaxable);
  // each bill is rounded once to the nearest rupee, so the round-off of a bill is at most 50 paise; more than that over the month is a mismatch
  const allowed = r2(0.5 * input.bills.length + 1);
  const docs = input.bills.map((b) => b.docNo).filter(Boolean).sort();

  return {
    supplies: { rows: supplies.map(withTotal), total: withTotal({ rate: 0, ...sumTotals(supplies) }) },
    returns: {
      rows: returnsByRate.map(withTotal), total: withTotal({ rate: 0, ...sumTotals(returnsByRate) }),
      cash_returns: { count: input.cashReturns.count, amount: r2(input.cashReturns.amount) },
    },
    net: { rows: net.map(withTotal), total: withTotal({ rate: 0, ...sumTotals(net) }) },
    buckets: Array.from(buckets.values())
      .map((c) => ({ buyer: c.buyer, place: c.place, rate: c.rate, taxable: r2(c.taxable), cgst: r2(c.cgst), sgst: r2(c.sgst), igst: r2(c.igst), tax: r2(c.tax) }))
      .sort((a, b) => a.buyer.localeCompare(b.buyer) || a.place.localeCompare(b.place) || a.rate - b.rate),
    nil: Array.from(nil.values())
      .map((c) => ({ kind: c.kind as SupplyKind, label: KIND_LABEL[c.kind as SupplyKind], buyer: c.buyer, place: c.place, supplied: r2(c.supplied), returned: r2(c.returned), net: r2(c.supplied - c.returned) }))
      .sort((a, b) => SUPPLY_KINDS.indexOf(a.kind) - SUPPLY_KINDS.indexOf(b.kind) || a.buyer.localeCompare(b.buyer) || a.place.localeCompare(b.place)),
    tie_out: { bills_total: r2(billsTotal), taxable_and_tax: r2(taxPlusTaxable), round_off: roundOff, allowed, ok: Math.abs(roundOff) <= allowed },
    documents: { issued: input.bills.length, first: docs[0] ?? null, last: docs[docs.length - 1] ?? null, cancelled: input.cancelled.length, gaps: input.gaps },
  };
}

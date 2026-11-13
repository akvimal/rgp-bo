/**
 * The month's adjustments that touch the return but are not sales (docs/planning/GST_SALES_REPORT.md, phase 2). Pure: no framework, no database.
 *
 *  - stock written off (expired, near expiry, damaged): no sale, but the GST paid when it was bought may need reversing as input credit
 *  - goods returned to a vendor: a vendor return (credited later on an invoice) or an out-pass whose method is "returned to the vendor"
 *  - vendor credits applied on purchase invoices in the month: what lowers the input credit
 *
 * This only gathers the figures by GST rate. Whether any of it is reversed, and when, is for the business's CA (see the questions in the doc).
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type AdjKind = 'WRITE_OFF' | 'VENDOR_RETURN' | 'VENDOR_PASS' | 'CREDIT_APPLIED' | 'GIVEN_OUT';

export interface AdjRow {
  kind: AdjKind;
  /** where the figure came from: PASS, LEGACY_PASS (disposed earlier, recorded now), TAGGED (an old write-off confirmed as expiry), OPEN or ADJUSTED for a vendor return */
  source: string;
  reason?: string | null;
  rate: number;
  lines: number;
  qty: number;
  /** the purchase value before GST */
  taxable: number;
  /** the GST paid on it */
  tax: number;
  /** the value at MRP, for goods given out (shown beside the cost; the CA decides which value applies) */
  mrp?: number;
}

export const SOURCE_LABEL: Record<string, string> = {
  PASS: 'Out-passes', LEGACY_PASS: 'Recorded as disposed earlier', TAGGED: 'Old write-offs confirmed as expiry',
  SAMPLE: 'Free samples', GIFT: 'Gifts and promotions', OWN_USE: 'Own use (the shop or its staff)',
  OPEN: 'Not yet credited by the vendor', ADJUSTED: 'Credited on a purchase invoice', CREDIT: 'Credits applied this month',
};
export const REASON_LABEL: Record<string, string> = { EXPIRED: 'Expired', NEAR_EXPIRY: 'Near expiry', DAMAGED: 'Damaged' };

export interface AdjLine { source: string; label: string; reason: string | null; reason_label: string | null; rate: number; lines: number; qty: number; taxable: number; tax: number; mrp: number }
export interface AdjSection { rows: AdjLine[]; by_rate: Array<{ rate: number; taxable: number; tax: number }>; total: { lines: number; qty: number; taxable: number; tax: number; mrp: number } }

function section(rows: AdjRow[]): AdjSection {
  const lines: AdjLine[] = rows
    .map((r) => ({
      source: r.source, label: SOURCE_LABEL[r.source] || r.source, reason: r.reason ?? null, reason_label: r.reason ? REASON_LABEL[r.reason] || r.reason : null,
      rate: r.rate, lines: r.lines, qty: r.qty, taxable: r2(r.taxable), tax: r2(r.tax), mrp: r2(r.mrp ?? 0),
    }))
    .sort((a, b) => a.source.localeCompare(b.source) || String(a.reason).localeCompare(String(b.reason)) || a.rate - b.rate);
  const byRate = new Map<number, { rate: number; taxable: number; tax: number }>();
  for (const l of lines) {
    const c = byRate.get(l.rate) || { rate: l.rate, taxable: 0, tax: 0 };
    c.taxable += l.taxable; c.tax += l.tax;
    byRate.set(l.rate, c);
  }
  return {
    rows: lines,
    by_rate: Array.from(byRate.values()).map((c) => ({ rate: c.rate, taxable: r2(c.taxable), tax: r2(c.tax) })).sort((a, b) => a.rate - b.rate),
    total: {
      lines: lines.reduce((t, l) => t + l.lines, 0), qty: lines.reduce((t, l) => t + l.qty, 0),
      taxable: r2(lines.reduce((t, l) => t + l.taxable, 0)), tax: r2(lines.reduce((t, l) => t + l.tax, 0)), mrp: r2(lines.reduce((t, l) => t + l.mrp, 0)),
    },
  };
}

export function buildAdjustments(rows: AdjRow[]) {
  const of = (k: AdjKind) => section(rows.filter((r) => r.kind === k));
  const write_offs = of('WRITE_OFF');
  return {
    write_offs,
    vendor_returns: of('VENDOR_RETURN'),
    vendor_passes: of('VENDOR_PASS'),
    credits_applied: of('CREDIT_APPLIED'),
    given_out: of('GIVEN_OUT'),
    /** the GST paid on written-off stock, by rate: the figure a reversal of input credit would start from (the CA decides whether and when) */
    reversal_candidate: write_offs.by_rate,
    any: rows.length > 0,
  };
}

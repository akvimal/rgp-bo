/**
 * The rules of a line of a scanned invoice that need no database: what a line still lacks before it can be checked, how what was typed is
 * cleaned, and the invoice item a checked line becomes. The same arithmetic the invoice form uses, so a line shows the same total either side.
 */
export interface ScanLine {
  productid: number | null;
  batch: string;
  exp: string;            // YYYY-MM or ''
  mrp: number | null;
  qty: number | null;
  free: number;
  rate: number | null;
  disc: number;
  tax: number | null;
  hsn?: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** what the line still lacks, in the words the form uses; empty when it can be checked */
export function missingFor(l: ScanLine, rates: number[], noexpiry: boolean): string[] {
  const out: string[] = [];
  if (!l.productid) out.push('product');
  if (!String(l.batch || '').trim()) out.push('batch');
  if (!l.exp && !noexpiry) out.push('expiry');
  if (!((num(l.mrp) ?? 0) > 0)) out.push('MRP');
  if (!((num(l.qty) ?? 0) > 0)) out.push('quantity');
  if (num(l.rate) === null || (num(l.rate) as number) < 0) out.push('rate');
  if (l.tax === null || l.tax === undefined || !rates.includes(Number(l.tax))) out.push('GST rate');
  const d = num(l.disc) ?? 0;
  if (d < 0 || d > 100) out.push('discount');
  return out;
}

export const EXPIRY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** what the person typed for a line, cleaned; throws one plain sentence when something is not allowed */
export function cleanScanLine(b: any): Partial<ScanLine> & { description?: string } {
  const out: any = {};
  if ('productid' in b) out.productid = b.productid ? Number(b.productid) : null;
  if ('batch' in b) out.batch = String(b.batch ?? '').trim().toUpperCase().slice(0, 60);
  if ('exp' in b) {
    const e = String(b.exp ?? '').trim();
    if (e && !EXPIRY.test(e)) throw new Error('The expiry should look like 08/27.');
    if (e && (+e.slice(0, 4) < 2015 || +e.slice(0, 4) > 2060)) throw new Error('That expiry year is not likely: check it.');
    out.exp = e;
  }
  for (const k of ['mrp', 'qty', 'rate', 'tax']) {
    if (k in b) { const n = num(b[k]); if (n !== null && n < 0) throw new Error(`${k === 'qty' ? 'Quantity' : k.toUpperCase()} cannot be negative.`); out[k] = n; }
  }
  if ('free' in b) { const n = num(b.free) ?? 0; if (n < 0) throw new Error('Free quantity cannot be negative.'); out.free = n; }
  if ('disc' in b) { const n = num(b.disc) ?? 0; out.disc = Math.min(100, Math.max(0, n)); }
  if ('hsn' in b) out.hsn = String(b.hsn ?? '').replace(/\s+/g, '').slice(0, 20) || null;
  if ('description' in b) out.description = String(b.description ?? '').slice(0, 500);
  return out;
}

/** the amount of the line before tax */
export const lineAmount = (qty: number, rate: number, disc: number): number => r2(qty * rate * (1 - disc / 100));

/** the invoice item a checked line becomes (the item form's own figures) */
export function itemFromLine(invoiceId: number, l: ScanLine, userId: number) {
  const rate = Number(l.rate), tax = Number(l.tax) || 0, disc = Number(l.disc) || 0;
  return {
    invoiceid: invoiceId, productid: l.productid, batch: String(l.batch).trim().toUpperCase(),
    ...(l.exp ? { expdate: `${l.exp}-01` } : {}),                      // an expiry is kept as the 1st of its month
    mrpcost: Number(l.mrp), qty: Number(l.qty), freeqty: Number(l.free) || 0, ptrvalue: rate, ptrcost: r2(rate * (1 + tax / 100)),
    discpcnt: disc, taxpcnt: tax, total: lineAmount(Number(l.qty), rate, disc),
    ...(l.hsn ? { hsn: l.hsn } : {}),
    status: 'VERIFIED', verifiedby: userId,
  };
}

export interface ScanCounts { open: number; verified: number; discarded: number; total: number }
export function countsOf(lines: { state: string }[]): ScanCounts {
  const n = (s: string) => lines.filter((l) => l.state === s).length;
  return { open: n('OPEN'), verified: n('VERIFIED'), discarded: n('DISCARDED'), total: lines.length };
}

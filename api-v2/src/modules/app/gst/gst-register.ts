/**
 * The sales register and the monthly summary, as pure rules: months, the HSN summary, totals, and gaps in a numbered series.
 * The database work is in gst-register.service.ts.
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const isMonth = (v: any) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** the first and last day of a 'YYYY-MM' month */
export function monthBounds(month: string): { from: string; to: string } {
  const y = +month.slice(0, 4), m = +month.slice(5, 7);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** the month a date falls in */
export const monthOf = (day: string) => day.slice(0, 7);

/** a month can be closed once it is over */
export function monthIsOver(month: string, today: string): boolean {
  return monthOf(today) > month;
}

export function monthLabel(month: string): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;
}

export interface HsnLine {
  hsn: string | null;
  source: 'own' | 'category' | 'none';
  rate: number;
  qty: number;
  taxable: number;
  tax: number;
  product?: string;
}

export interface HsnRow { hsn: string; source: 'own' | 'category' | 'none'; rate: number; qty: number; taxable: number; tax: number; products: number }

/** the HSN summary: one row per code and rate; a code that is only a category's default stays marked provisional, an unknown one is "not known" */
export function groupHsn(lines: HsnLine[]): HsnRow[] {
  const map = new Map<string, HsnRow & { names: Set<string> }>();
  for (const l of lines) {
    const hsn = l.hsn || '';
    const key = `${hsn}|${l.rate}`;
    const cur = map.get(key) || { hsn, source: l.source, rate: l.rate, qty: 0, taxable: 0, tax: 0, products: 0, names: new Set<string>() };
    if (l.source === 'own') cur.source = 'own';
    cur.qty += l.qty; cur.taxable += l.taxable; cur.tax += l.tax;
    if (l.product) cur.names.add(l.product);
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map(({ names, ...r }) => ({ ...r, qty: r2(r.qty), taxable: r2(r.taxable), tax: r2(r.tax), products: names.size }))
    .sort((a, b) => (a.hsn === '' ? 1 : b.hsn === '' ? -1 : a.hsn.localeCompare(b.hsn)) || a.rate - b.rate);
}

/** what stands between the HSN summary and a return: codes not known, codes that are a default, codes shorter than the return needs */
export function hsnIssues(rows: HsnRow[], digits: number) {
  const unknown = rows.filter((r) => r.source === 'none');
  const provisional = rows.filter((r) => r.source === 'category');
  const short = rows.filter((r) => r.hsn !== '' && r.hsn.length < digits);
  return {
    unknown_rows: unknown.length, unknown_value: r2(unknown.reduce((t, r) => t + r.taxable, 0)),
    provisional_rows: provisional.length, provisional_value: r2(provisional.reduce((t, r) => t + r.taxable, 0)),
    short_rows: short.length, digits,
    clean: unknown.length === 0 && provisional.length === 0 && short.length === 0,
  };
}

export interface RateTotals { rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }

/** tax invoices less credit notes, rate by rate */
export function netByRate(invoices: RateTotals[], credits: RateTotals[]): RateTotals[] {
  const map = new Map<number, RateTotals>();
  const add = (r: RateTotals, sign: number) => {
    const c = map.get(r.rate) || { rate: r.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
    c.taxable += sign * r.taxable; c.cgst += sign * r.cgst; c.sgst += sign * r.sgst; c.igst += sign * r.igst; c.tax += sign * r.tax;
    map.set(r.rate, c);
  };
  invoices.forEach((r) => add(r, 1));
  credits.forEach((r) => add(r, -1));
  return Array.from(map.values()).map((c) => ({ rate: c.rate, taxable: r2(c.taxable), cgst: r2(c.cgst), sgst: r2(c.sgst), igst: r2(c.igst), tax: r2(c.tax) })).sort((a, b) => a.rate - b.rate);
}

export const sumTotals = (rows: RateTotals[]) => ({
  taxable: r2(rows.reduce((t, r) => t + r.taxable, 0)), cgst: r2(rows.reduce((t, r) => t + r.cgst, 0)), sgst: r2(rows.reduce((t, r) => t + r.sgst, 0)),
  igst: r2(rows.reduce((t, r) => t + r.igst, 0)), tax: r2(rows.reduce((t, r) => t + r.tax, 0)),
});

/** the tax payable after the input credit, or the credit left to carry forward */
export function payable(outputTax: number, itcClaimable: number) {
  const net = r2(outputTax - itcClaimable);
  return { payable: net > 0 ? net : 0, carry_forward: net < 0 ? r2(-net) : 0 };
}

/** numbers missing from a series: 'INV/26-27/000003' with 000004 absent between 000003 and 000005; each prefix and year is its own series */
export function findGaps(docNos: string[]): string[] {
  const series = new Map<string, number[]>();
  for (const no of docNos) {
    const m = /^(.*\/)(\d+)$/.exec(no);
    if (!m) continue;
    series.set(m[1], [...(series.get(m[1]) || []), +m[2]]);
  }
  const gaps: string[] = [];
  for (const [prefix, nums] of series) {
    nums.sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) for (let n = nums[i - 1] + 1; n < nums[i] && gaps.length < 50; n++) gaps.push(`${prefix}${String(n).padStart(6, '0')}`);
  }
  return gaps;
}

/** why a month cannot be closed yet, or null when it can */
export function closeProblem(a: {
  registered: boolean; goLive: string | null; month: string; today: string; alreadyClosed: boolean;
  issues: { unknown_rows: number; provisional_rows: number; short_rows: number; digits: number }; acceptHsn: boolean;
}): string | null {
  if (!a.registered) return 'Only a registered business closes a month.';
  if (!monthIsOver(a.month, a.today)) return 'A month can be closed once it is over.';
  if (a.goLive && a.month < a.goLive.slice(0, 7)) return 'That month is before the go-live date.';
  if (a.alreadyClosed) return 'That month is already closed.';
  const i = a.issues;
  if ((i.unknown_rows || i.provisional_rows || i.short_rows) && !a.acceptHsn) {
    return `The HSN summary has ${i.unknown_rows} line(s) with no HSN, ${i.provisional_rows} on a provisional category code and ${i.short_rows} shorter than ${i.digits} digits. Fix them under GST > HSN codes, or accept them as they are to close the month.`;
  }
  return null;
}

/** an ARN as typed: letters and digits, up to 30 */
export function parseArn(v: any): { value?: string | null; error?: string } {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return { value: null };
  if (!/^[A-Z0-9]{6,30}$/.test(s)) return { error: 'The ARN is letters and digits only (6 to 30 characters).' };
  return { value: s };
}

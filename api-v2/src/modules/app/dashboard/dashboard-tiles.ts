/**
 * The tiles of the Owner and Manager views (DASHBOARD_AND_MENU_DESIGN 4 and 5.2): a value, the change against a chosen comparison, and whether that
 * change is good (up is good for sales, down is good for discounts). Pure: relative imports only, so it is tested without the framework or a database.
 */

export type Compare = 'prev' | 'lastyear';
export const compareOf = (v: any): Compare => (v === 'lastyear' ? 'lastyear' : 'prev');

const MS = 86400000;
const t = (day: string) => Date.parse(day.slice(0, 10) + 'T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => iso(t(day) + n * MS);

export interface Periods {
  /** the period shown: from the first of the month to today, inclusive of today (`to` is the day after) */
  from: string;
  to: string;
  /** the same number of days a month earlier, or a year earlier; never reaching into the month after */
  cmpFrom: string;
  cmpTo: string;
}

/** Month to date against the same days of the previous month (clamped to its length) or of the same month a year earlier. */
export function periodsFor(today: string, compare: Compare): Periods {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8, 10));
  const from = `${today.slice(0, 7)}-01`;
  const to = addDays(today, 1);
  const cy = compare === 'lastyear' ? y - 1 : m === 1 ? y - 1 : y;
  const cm = compare === 'lastyear' ? m : m === 1 ? 12 : m - 1;
  const cmpFrom = `${cy}-${String(cm).padStart(2, '0')}-01`;
  const len = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  const cmpTo = addDays(cmpFrom, Math.min(d, len));
  return { from, to, cmpFrom, cmpTo };
}

export interface Delta {
  /** change in percent against the comparison, null when there is nothing to compare */
  pct: number | null;
  dir: 'up' | 'down' | 'flat' | null;
  tone: 'good' | 'bad' | 'flat' | null;
}

/** The change of a value against its comparison. `goodWhen` says which way is good for this metric. */
export function deltaOf(value: number, prev: number, goodWhen: 'up' | 'down'): Delta {
  if (!prev) return { pct: null, dir: null, tone: null };
  const pct = Math.round(((value - prev) / Math.abs(prev)) * 1000) / 10;
  if (Math.abs(pct) < 0.5) return { pct, dir: 'flat', tone: 'flat' };
  const dir = pct > 0 ? 'up' : 'down';
  return { pct, dir, tone: dir === goodWhen ? 'good' : 'bad' };
}

/** share of a whole as a percentage with one decimal; 0 when there is no whole */
export const sharePct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * Gross margin over the lines whose cost is known. `coverage` is the share of the sales (net of GST) that those lines are, so the figure is never
 * shown as if it covered everything; with less than `minCoverage` it is withheld.
 */
export function marginOf(netCovered: number, cogsCovered: number, netAll: number, minCoverage = 80): { pct: number | null; coverage: number } {
  const coverage = sharePct(netCovered, netAll);
  if (netCovered <= 0 || coverage < minCoverage) return { pct: null, coverage };
  return { pct: sharePct(netCovered - cogsCovered, netCovered), coverage };
}

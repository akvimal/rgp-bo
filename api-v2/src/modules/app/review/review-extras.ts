/** The weekly review's week-level extras: the cash drawer by shift, and what customers asked for that could not be supplied. Pure, so tested without a database. */

/** a drawer counted this many rupees or less away from the book is not worth a word (the same as the checklist assistant uses) */
export const CASH_TOLERANCE = 1;
/** the lists show at most this many rows */
export const EXTRAS_LIMIT = 20;

export interface ShiftRow {
  id: number; shift_date: string; name: string | null; store: string; status: string;
  expected: number | null; counted: number | null; variance: number | null; who: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (d: any) => String(d).slice(0, 10);

/**
 * How the cash drawer did in the week: shifts closed, how many were out by more than the tolerance (short and over, with the totals and the biggest),
 * and shifts that were opened and never closed by the end of their day.
 */
export const cashSummary = (rows: ShiftRow[], today: string) => {
  const closed = rows.filter((r) => r.status === 'CLOSED');
  const off = closed.filter((r) => Math.abs(Number(r.variance) || 0) > CASH_TOLERANCE);
  const short = off.filter((r) => Number(r.variance) < 0), over = off.filter((r) => Number(r.variance) > 0);
  const unclosed = rows.filter((r) => r.status === 'OPEN' && dayOf(r.shift_date) < today);
  return {
    shifts: rows.length, closed: closed.length, off: off.length, short: short.length, over: over.length,
    shortTotal: r2(Math.abs(short.reduce((a, r) => a + Number(r.variance), 0))), overTotal: r2(over.reduce((a, r) => a + Number(r.variance), 0)),
    biggest: r2(off.reduce((m, r) => Math.max(m, Math.abs(Number(r.variance))), 0)),
    offList: [...off].sort((a, b) => Math.abs(Number(b.variance)) - Math.abs(Number(a.variance))).slice(0, EXTRAS_LIMIT),
    unclosedList: unclosed.slice(0, EXTRAS_LIMIT),
    unclosed: unclosed.length,
  };
};

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/** the brands checked at the counter with no match in stock, most often first; the same brand typed differently is counted once, with its composition */
export const topLookups = (rows: { text: string | null; composition: string | null }[], limit = 8) => {
  const m = new Map<string, { name: string; composition: string | null; count: number }>();
  for (const r of rows) {
    const raw = (r.text || '').replace(/\s+/g, ' ').trim();
    if (raw.length < 2) continue;
    const k = norm(raw);
    const g = m.get(k) ?? { name: raw, composition: r.composition || null, count: 0 };
    if (!g.composition && r.composition) g.composition = r.composition;
    g.count += 1;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
};

/** what was asked for most often, with the spelling first seen; empty and one-letter entries are left out */
export const topAsked = (rows: { product_text: string | null }[], limit = 8) => {
  const m = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    const raw = (r.product_text || '').replace(/\s+/g, ' ').trim();
    if (raw.length < 2) continue;
    const k = norm(raw);
    const g = m.get(k) ?? { name: raw, count: 0 };
    g.count += 1;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
};

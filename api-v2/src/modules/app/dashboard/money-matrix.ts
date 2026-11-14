/**
 * The category x month matrix of the financial dashboard (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2). Pure: rows of the `money_flow` view go
 * in, a matrix with sections, totals, a profit summary and a confidence line comes out. Transfers never reach it (they are not in the view); capital
 * and owner money and unclassified rows are shown but kept out of profit.
 */
export interface FlowRow { month: string; cls: string; grp: string; category: string; amount: number; n?: number; unclassified?: boolean }

export const CLASS_ORDER = ['INCOME', 'INCOME_REDUCTION', 'COST_OF_GOODS', 'OPERATING_COST', 'PEOPLE', 'FINANCE_COST', 'CAPITAL_OWNER', 'UNCLASSIFIED'];
export const CLASS_LABEL: Record<string, string> = {
  INCOME: 'Sales', INCOME_REDUCTION: 'Returns', COST_OF_GOODS: 'Purchases', OPERATING_COST: 'Operating cost', PEOPLE: 'People',
  FINANCE_COST: 'Finance cost', CAPITAL_OWNER: 'Capital and owner (not in profit)', UNCLASSIFIED: 'Unclassified (not in profit)',
};
/** classes that make up the running cost of the business */
const RUNNING = ['OPERATING_COST', 'PEOPLE', 'FINANCE_COST'];
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface MatrixRow { grp: string; category: string; cells: number[]; total: number; pct: number | null; prev: number | null; change: number | null; unclassified: boolean; count: number }
export interface MatrixSection { cls: string; label: string; cells: number[]; total: number; pct: number | null; prev: number | null; change: number | null; rows: MatrixRow[] }

/** "YYYY-MM" for every month from `from` to `to`, both included */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = +from.slice(0, 4), m = +from.slice(5, 7);
  const ey = +to.slice(0, 4), em = +to.slice(5, 7);
  while ((y < ey || (y === ey && m <= em)) && out.length < 60) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

/** the financial year (1 April to 31 March) that holds `today` ("YYYY-MM-DD") as a month range */
export function financialYear(today: string): { from: string; to: string; label: string } {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const start = m >= 4 ? y : y - 1;
  return { from: `${start}-04`, to: `${start + 1}-03`, label: `FY ${start}-${String(start + 1).slice(2)}` };
}

const shiftMonth = (ym: string, by: number) => { const t = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + by; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

/** the same number of months straight before `from` (previous), or a year earlier (yoy) */
export function compareRange(from: string, to: string, compare: string): { from: string; to: string } | null {
  const n = monthsBetween(from, to).length;
  if (compare === 'prev') return { from: shiftMonth(from, -n), to: shiftMonth(from, -1) };
  if (compare === 'yoy') return { from: shiftMonth(from, -12), to: shiftMonth(to, -12) };
  return null;
}

/** percentage change, null when there is nothing to compare with */
export const changePct = (now: number, before: number | null): number | null => (before === null || Math.abs(before) < 0.005 ? null : r2(((now - before) / Math.abs(before)) * 100));

export function buildMatrix(rows: FlowRow[], months: string[], opts: { hideCost?: boolean; compareRows?: FlowRow[]; compareMonths?: string[] } = {}) {
  const idx = new Map(months.map((m, i) => [m, i]));
  const cidx = new Map((opts.compareMonths || []).map((m, i) => [m, i]));
  const hidden = (cls: string) => !!opts.hideCost && cls === 'COST_OF_GOODS';
  type Acc = { cls: string; grp: string; category: string; cells: number[]; prev: number; unclassified: boolean; count: number };
  const acc = new Map<string, Acc>();
  const touch = (r: FlowRow) => {
    const k = `${r.cls}|${r.grp}|${r.category}`;
    let a = acc.get(k);
    if (!a) { a = { cls: r.cls, grp: r.grp, category: r.category, cells: months.map(() => 0), prev: 0, unclassified: false, count: 0 }; acc.set(k, a); }
    return a;
  };
  for (const r of rows) {
    if (hidden(r.cls) || !idx.has(r.month)) continue;
    const a = touch(r);
    a.cells[idx.get(r.month)!] += Number(r.amount) || 0;
    a.count += r.n ?? 1;
    a.unclassified = a.unclassified || !!r.unclassified || r.cls === 'UNCLASSIFIED';
  }
  const haveCompare = !!opts.compareRows;
  for (const r of opts.compareRows || []) { if (hidden(r.cls) || !cidx.has(r.month)) continue; touch(r).prev += Number(r.amount) || 0; }

  const sections = new Map<string, Acc[]>();
  for (const a of acc.values()) { const l = sections.get(a.cls) || []; l.push(a); sections.set(a.cls, l); }
  const sum = (c: number[]) => r2(c.reduce((x, y) => x + y, 0));
  const addCells = (list: number[][]) => months.map((_, i) => r2(list.reduce((t, c) => t + c[i], 0)));

  const st: Record<string, { cells: number[]; total: number; prev: number }> = {};
  for (const cls of CLASS_ORDER) {
    const list = sections.get(cls) || [];
    const cells = addCells(list.map((a) => a.cells));
    st[cls] = { cells, total: sum(cells), prev: r2(list.reduce((t, a) => t + a.prev, 0)) };
  }
  const salesAt = (i: number) => st.INCOME.cells[i] - st.INCOME_REDUCTION.cells[i];
  const salesTotal = st.INCOME.total - st.INCOME_REDUCTION.total;
  const salesPrev = st.INCOME.prev - st.INCOME_REDUCTION.prev;
  const pctOf = (v: number) => (salesTotal > 0.005 ? r2((v / salesTotal) * 100) : null);

  const out: MatrixSection[] = [];
  for (const cls of CLASS_ORDER) {
    const list = (sections.get(cls) || []).sort((a, b) => a.grp.localeCompare(b.grp) || Math.abs(sum(b.cells)) - Math.abs(sum(a.cells)));
    if (!list.length) continue;
    const t = st[cls];
    out.push({
      cls, label: CLASS_LABEL[cls], cells: t.cells, total: t.total, pct: pctOf(t.total), prev: haveCompare ? t.prev : null, change: haveCompare ? changePct(t.total, t.prev) : null,
      rows: list.map((a) => {
        const total = sum(a.cells);
        return { grp: a.grp, category: a.category, cells: a.cells.map(r2), total, pct: pctOf(total), prev: haveCompare ? r2(a.prev) : null, change: haveCompare ? changePct(total, a.prev) : null, unclassified: a.unclassified, count: a.count };
      }),
    });
  }

  // purchases are not cost of goods sold (the change in stock is not counted), so the figures are named for what they are
  const runningCells = months.map((_, i) => RUNNING.reduce((t, c) => t + st[c].cells[i], 0));
  const running = RUNNING.reduce((t, c) => t + st[c].total, 0);
  const runningPrev = RUNNING.reduce((t, c) => t + st[c].prev, 0);
  const pur = st.COST_OF_GOODS;
  const profitTotal = salesTotal - pur.total - running;
  const profitPrev = salesPrev - pur.prev - runningPrev;
  const summary = {
    sales: { cells: months.map((_, i) => r2(salesAt(i))), total: r2(salesTotal), prev: haveCompare ? r2(salesPrev) : null, change: haveCompare ? changePct(salesTotal, salesPrev) : null },
    runningCost: { cells: runningCells.map(r2), total: r2(running), pct: pctOf(running), prev: haveCompare ? r2(runningPrev) : null, change: haveCompare ? changePct(running, runningPrev) : null },
    // owner only: a manager sees no purchases, margin or profit
    purchases: opts.hideCost ? null : { cells: pur.cells, total: pur.total, pct: pctOf(pur.total) },
    margin: opts.hideCost ? null : { cells: months.map((_, i) => r2(salesAt(i) - pur.cells[i])), total: r2(salesTotal - pur.total), pct: pctOf(salesTotal - pur.total) },
    profit: opts.hideCost ? null : {
      cells: months.map((_, i) => r2(salesAt(i) - pur.cells[i] - runningCells[i])), total: r2(profitTotal), pct: pctOf(profitTotal),
      prev: haveCompare ? r2(profitPrev) : null, change: haveCompare ? changePct(profitTotal, profitPrev) : null,
    },
  };

  // how far the figures can be trusted
  const every = out.flatMap((s) => s.rows);
  const all = every.reduce((t, r) => t + Math.abs(r.total), 0);
  const flaggedRows = every.filter((r) => r.unclassified);
  const flagged = flaggedRows.reduce((t, r) => t + Math.abs(r.total), 0);
  const flaggedCount = flaggedRows.reduce((t, r) => t + r.count, 0);
  const share = all > 0 ? r2((flagged / all) * 100) : 0;
  const confidence = {
    unclassifiedShare: share,
    unclassifiedCount: flaggedCount,
    notes: [
      'Sales and purchases are before GST. Profit is sales less purchases less running cost; the change in stock is not counted, so it is an estimate until the books are closed.',
      ...(flagged > 0 ? [`${share}% of the money (${flaggedCount} entries) has no category yet. Entries with no mapping are not in profit; products with no category are counted, under "Unclassified".`] : []),
    ],
  };
  return { months, sections: out, summary, confidence };
}

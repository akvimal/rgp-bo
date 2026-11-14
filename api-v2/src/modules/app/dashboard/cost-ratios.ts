/**
 * Cost ratios against sales over the months (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.2 item 5). Pure. For each cost group the share of
 * sales each month, the usual band from the earlier months (mean and one standard deviation), and whether the latest complete month sits above it,
 * so a cost that creeps up is seen before it is large.
 */
export interface CostMonth { month: string; grp: string; amount: number }
export interface SalesMonth { month: string; sales: number }

const r1 = (n: number) => Math.round(n * 10) / 10;
const MIN_MONTHS = 4;

export function costRatios(costs: CostMonth[], sales: SalesMonth[], months: string[], opts: { latest?: string } = {}) {
  const salesBy = new Map(sales.map((s) => [s.month, s.sales]));
  const groups = Array.from(new Set(costs.map((c) => c.grp))).sort();
  // the latest month counts only when it is over, so a half-finished month does not look cheap
  const latest = opts.latest && months.includes(opts.latest) ? opts.latest : months[months.length - 1];
  const rows = groups.map((grp) => {
    const series = months.map((m) => {
      const amount = costs.filter((c) => c.grp === grp && c.month === m).reduce((t, c) => t + c.amount, 0);
      const s = salesBy.get(m) || 0;
      return { month: m, amount: Math.round(amount), pct: s > 0 ? r1((amount / s) * 100) : null };
    });
    // the band starts when the cost first appears, so a cost that is new does not look unusual against months with none
    const first = series.find((p) => p.amount > 0)?.month ?? '9999-99';
    const earlier = series.filter((p) => p.month >= first && p.month < latest && p.pct !== null).map((p) => p.pct as number);
    let band: { low: number; high: number; mean: number } | null = null;
    if (earlier.length >= MIN_MONTHS) {
      const mean = earlier.reduce((t, v) => t + v, 0) / earlier.length;
      const sd = Math.sqrt(earlier.reduce((t, v) => t + (v - mean) ** 2, 0) / earlier.length);
      band = { mean: r1(mean), low: r1(Math.max(0, mean - sd)), high: r1(mean + sd) };
    }
    const now = series.find((p) => p.month === latest);
    const status = !band || !now || now.pct === null ? 'thin' : now.pct > band.high + 0.05 ? 'high' : now.pct < band.low - 0.05 ? 'low' : 'usual';
    return { grp, series, band, latest: now?.pct ?? null, status };
  }).sort((a, b) => (b.series.reduce((t, p) => t + p.amount, 0)) - (a.series.reduce((t, p) => t + p.amount, 0)));

  const high = rows.filter((r) => r.status === 'high');
  const notes = high.map((r) => `${r.grp} is ${r.latest}% of sales, above its usual ${r.band!.low}% to ${r.band!.high}%.`);
  if (rows.length && rows.every((r) => r.status === 'thin')) notes.push('Not enough months yet to say what is usual: it needs at least four earlier months of sales and costs.');
  return { months, latest, groups: rows, notes };
}

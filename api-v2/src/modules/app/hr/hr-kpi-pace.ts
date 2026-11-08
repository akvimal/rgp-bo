import { pctFor } from './hr-kpi-engine.service';

/** Whether a system KPI measure is on course part-way through the month. Pure, so it is tested without the engine. */
export interface PaceInput { rule: any; direction: 'higher' | 'lower' | null; raw: number | null }

/**
 * A "higher is better" measure with a target and floor is behind when the share of the way from floor to target reached so far is less than
 * `threshold` per cent of the share of the month gone. A "lower is better" measure is behind once it has already cost half its points.
 */
export function paceStatus(item: PaceInput, day: number, daysInMonth: number, threshold: number): { behind: boolean; progress: number | null } {
  if (item.raw === null || item.raw === undefined || !item.rule) return { behind: false, progress: null };
  if (item.direction === 'lower') {
    const pct = pctFor(item.rule, item.raw);
    return { behind: pct <= 50, progress: Math.round(pct) };
  }
  if (item.rule.kind !== 'linear') return { behind: false, progress: null };
  const target = Number(item.rule.target), floor = Number(item.rule.floor);
  if (!(target > floor)) return { behind: false, progress: null };
  const frac = Math.min(1, Math.max(day / daysInMonth, 0.01));
  const share = Math.max(0, (item.raw - floor) / (target - floor));
  const pace = Math.round((share / frac) * 100);
  return { behind: share < (frac * threshold) / 100, progress: pace };
}

/** the reminder text for a weekly KPI check: what the person's measures are and what earns full marks */
export function kpiNotes(measures: { name: string; source: string; direction: 'higher' | 'lower' | null; unit: string | null; rule: any; description?: string | null }[]): string {
  const money = (n: number) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-IN') : String(n));
  const unit = (u: string | null) => (u === 'Rs' ? 'Rs ' : '');
  const lines = measures.map((m) => {
    if (m.source !== 'SYSTEM' || !m.rule) return `- ${m.name}: rated by your manager at month end.`;
    if (m.rule.kind === 'linear') {
      return m.direction === 'lower'
        ? `- ${m.name}: full marks at ${unit(m.unit)}${money(m.rule.target)} or less, none at ${unit(m.unit)}${money(m.rule.floor)} or more.`
        : `- ${m.name}: full marks at ${unit(m.unit)}${money(m.rule.target)}, none at ${unit(m.unit)}${money(m.rule.floor)} or less.`;
    }
    const first = m.rule.steps?.[0];
    return `- ${m.name}: best when ${first ? `${unit(m.unit)}${money(first.upto)} or less` : 'low'}; each step above loses marks.`;
  });
  return ['Look at how you are doing on your KPI this month (My KPI shows the figures so far):', ...lines].join('\n').slice(0, 1900);
}

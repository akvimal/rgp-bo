import { SYSTEM_MEASURES, checkRule } from './hr-kpi-engine.service';

/**
 * What the assistant drafts for a job role (responsibilities, KPI measures, incentive bands) is untrusted: it is cleaned and checked here
 * before anyone sees it, and a person approves it before anything is saved. Pure, so it is tested without a model or a database.
 */
const clip = (v: any, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface RoleDraft { purpose: string; responsibilities: { text: string; measure: string }[] }

/** a purpose line and 3 to 10 responsibilities; `measure` says how it could be measured: a system measure key, or MANUAL */
export function cleanRole(raw: any): RoleDraft {
  const keys = SYSTEM_MEASURES.map((m) => m.key);
  const seen = new Set<string>();
  const list = (Array.isArray(raw?.responsibilities) ? raw.responsibilities : [])
    .map((x: any) => ({ text: clip(typeof x === 'string' ? x : x?.text, 160), measure: keys.includes(String(x?.measure || '')) ? String(x.measure) : 'MANUAL' }))
    .filter((x: any) => x.text.length >= 5 && !seen.has(x.text.toLowerCase()) && !!seen.add(x.text.toLowerCase()))
    .slice(0, 10);
  return { purpose: clip(raw?.purpose, 300), responsibilities: list };
}

export interface Summary { n: number; min: number; p25: number; median: number; p75: number; max: number }

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** a spread of figures, anonymous by construction: no one is named, and a spread of fewer than 3 figures is not given */
export function summarise(values: number[]): Summary | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < 3) return null;
  return { n: v.length, min: r2(v[0]), p25: r2(percentile(v, 0.25)), median: r2(percentile(v, 0.5)), p75: r2(percentile(v, 0.75)), max: r2(v[v.length - 1]) };
}

export interface KpiProposal {
  name: string; description: string; max_points: number; source: 'SYSTEM' | 'MANUAL'; system_key: string | null; rule: any; rating_scale: number; why: string;
}

/** weights that add up to exactly 100, as whole numbers, keeping the proportions (largest remainder) */
export function toHundred(weights: number[]): number[] {
  const total = weights.reduce((t, w) => t + Math.max(0, w), 0);
  if (!weights.length) return [];
  if (total <= 0) return weights.map((_, i) => (i === 0 ? 100 : 0));
  const exact = weights.map((w) => (Math.max(0, w) * 100) / total);
  const floor = exact.map(Math.floor);
  let left = 100 - floor.reduce((t, x) => t + x, 0);
  exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r).forEach(({ i }) => { if (left > 0) { floor[i] += 1; left -= 1; } });
  return floor;
}

/**
 * The KPI measures proposed for a role, kept only if they can work: a system measure must be one the engine can measure, once per role, with a
 * rule that passes the same check as a hand-made one; anything else becomes a manager-rated measure with a rating guide. Points are made to total 100.
 * `dropped` says what was refused and why, so the person is not left guessing.
 */
export function cleanKpis(raw: any, takenKeys: string[] = []): { kpis: KpiProposal[]; dropped: string[] } {
  const dropped: string[] = [];
  const used = new Set<string>(takenKeys);
  const out: KpiProposal[] = [];
  for (const x of (Array.isArray(raw?.kpis) ? raw.kpis : []).slice(0, 12)) {
    const name = clip(x?.name, 60);
    if (!name) continue;
    let source: 'SYSTEM' | 'MANUAL' = x?.source === 'SYSTEM' ? 'SYSTEM' : 'MANUAL';
    let key: string | null = null, rule: any = null;
    if (source === 'SYSTEM') {
      key = String(x?.system_key || '');
      try {
        if (used.has(key)) throw new Error('already used');
        rule = checkRule(key, x?.rule);
        used.add(key);
      } catch (e: any) {
        dropped.push(`${name}: ${used.has(key || '') ? 'that measure is already used for this role' : (e?.message || 'the rule does not work')}; made a manager-rated measure instead`);
        source = 'MANUAL'; key = null; rule = null;
      }
    }
    const desc = clip(x?.description, 200);
    if (source === 'MANUAL' && desc.length < 10) { dropped.push(`${name}: a manager-rated measure needs a rating guide; left out`); continue; }
    out.push({ name, description: desc, max_points: Number(x?.weight ?? x?.max_points) || 1, source, system_key: key, rule, rating_scale: 5, why: clip(x?.why, 200) });
  }
  const pts = toHundred(out.map((k) => k.max_points));
  out.forEach((k, i) => { k.max_points = pts[i]; });
  return { kpis: out.filter((k) => k.max_points > 0), dropped };
}

export interface BandProposal { min_percent: number; label: string; incentive_amount: number }

/** 2 to 6 bands: scores ascending from 0, labels, rupee amounts that never go down as the score goes up */
export function cleanBands(raw: any): BandProposal[] {
  const rows = (Array.isArray(raw?.bands) ? raw.bands : [])
    .map((b: any) => ({ min_percent: Math.round(Number(b?.min_percent) * 10) / 10, label: clip(b?.label, 30), incentive_amount: Math.round(Math.max(0, Number(b?.incentive_amount) || 0)) }))
    .filter((b: any) => Number.isFinite(b.min_percent) && b.min_percent >= 0 && b.min_percent <= 100 && b.label)
    .sort((a: any, b: any) => a.min_percent - b.min_percent);
  const unique = rows.filter((b: any, i: number) => i === 0 || b.min_percent !== rows[i - 1].min_percent).slice(0, 6);
  let top = 0;
  for (const b of unique) { top = Math.max(top, b.incentive_amount); b.incentive_amount = top; }
  return unique;
}

/** what a set of bands would have paid: for each person-month score, the amount of the highest band reached */
export function simulateBands(percents: number[], bands: { min_percent: number; incentive_amount: number }[], months: number) {
  const sorted = [...bands].sort((a, b) => b.min_percent - a.min_percent);
  const bandOf = (p: number) => sorted.find((b) => b.min_percent <= p);
  const paid = percents.map((p) => bandOf(p)?.incentive_amount ?? 0);
  const total = paid.reduce((t, x) => t + x, 0);
  const top = sorted.length ? sorted[0].incentive_amount : 0;
  return {
    people_months: percents.length,
    months,
    total_paid: r2(total),
    average_per_person_month: percents.length ? r2(total / percents.length) : 0,
    monthly_cost: months ? r2(total / months) : 0,
    top_amount: top,
    by_band: [...sorted].reverse().map((b) => ({ min_percent: b.min_percent, count: percents.filter((p) => bandOf(p) === b).length })),
  };
}

/** the most the bands could pay in a month if everyone of the role reached the top band, against a ceiling in per cent of the role's monthly payroll */
export function checkCeiling(headcount: number, topAmount: number, monthlyPayroll: number, ceilingPct: number | null): { worst_case: number; ceiling: number | null; over: boolean } {
  const worst = r2(headcount * topAmount);
  if (ceilingPct === null || !Number.isFinite(ceilingPct) || monthlyPayroll <= 0) return { worst_case: worst, ceiling: null, over: false };
  const ceiling = r2((monthlyPayroll * ceilingPct) / 100);
  return { worst_case: worst, ceiling, over: worst > ceiling };
}

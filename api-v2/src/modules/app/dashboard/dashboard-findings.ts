/**
 * Health findings (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 4). Every check returns a list of findings, each with a severity, and the page
 * shows what is wrong, where, how much is at stake and what to fix first. Pure: no framework, no database, relative imports only.
 *
 * Status comes from the worst severity present, not from an average: any Critical is "Act now" however good the sales are.
 * The score is the mean of the area scores and is capped so it never reads better than the status.
 */

export type Sev = 'critical' | 'major' | 'minor' | 'info';
export const SEV_ORDER: Sev[] = ['critical', 'major', 'minor', 'info'];
export type AreaKey = 'compliance' | 'cash' | 'sales' | 'stock' | 'purchasing' | 'customers' | 'people' | 'system';
export const AREAS: { key: AreaKey; label: string }[] = [
  { key: 'compliance', label: 'Compliance and legal' },
  { key: 'cash', label: 'Cash and shifts' },
  { key: 'sales', label: 'Sales' },
  { key: 'stock', label: 'Stock' },
  { key: 'purchasing', label: 'Purchasing and payables' },
  { key: 'customers', label: 'Customers and service' },
  { key: 'people', label: 'People' },
  { key: 'system', label: 'System and security' },
];

export type FindingStatus = 'act' | 'watch' | 'notes' | 'healthy';

export interface HFinding {
  /** the same cause has the same key every day, so it can be aged and snoozed */
  key: string;
  code: string;
  area: AreaKey;
  severity: Sev;
  storeid: number | null;
  store?: string;
  title: string;
  detail: string;
  count?: number;
  /** rupees at risk, when the finding has a money figure */
  amount?: number | null;
  link: string;
  /** who should put it right */
  owner: string;
  /** a legal or statutory duty: it cannot be snoozed, and it cannot be set below Major */
  legal: boolean;
  firstSeen?: string;
  daysOpen?: number;
  aged?: boolean;
  snoozedUntil?: string | null;
  snoozeReason?: string | null;
}

/** points taken off an area's 100 by one finding of this severity */
export const POINTS: Record<Sev, number> = { critical: 40, major: 15, minor: 3, info: 0 };
/** the overall score never reads better than the status: a Critical caps it below "Watch", a Major below "Healthy" */
export const CAP: Partial<Record<Sev, number>> = { critical: 59, major: 79 };
/** a Minor finding that stays open this long counts as Major (the same ladder as the compliance register) */
export const MINOR_TO_MAJOR_DAYS = 14;

export const worse = (a: Sev, b: Sev): Sev => (SEV_ORDER.indexOf(a) <= SEV_ORDER.indexOf(b) ? a : b);

/** a finding that has stayed open past its window climbs a level; Critical, Major and Info are not aged */
export function ageSeverity(sev: Sev, daysOpen: number): { severity: Sev; aged: boolean } {
  if (sev === 'minor' && daysOpen >= MINOR_TO_MAJOR_DAYS) return { severity: 'major', aged: true };
  return { severity: sev, aged: false };
}

/** the days between two YYYY-MM-DD dates (never negative) */
export const daysBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000));

/** the findings that count: not snoozed (a legal finding is never snoozed, whatever is stored), with age applied */
export function live(findings: HFinding[], today: string): HFinding[] {
  return findings
    .filter((f) => f.legal || !f.snoozedUntil || f.snoozedUntil < today)
    .map((f) => {
      const days = f.daysOpen ?? (f.firstSeen ? daysBetween(f.firstSeen, today) : 0);
      const a = ageSeverity(f.severity, days);
      return { ...f, daysOpen: days, severity: a.severity, aged: a.aged };
    });
}

/** an area's penalty: the first finding of a kind takes its full points, the others of the same kind half (so twenty minor items do not zero an area) */
export function penalty(findings: HFinding[]): number {
  const seen = new Map<string, number>();
  let total = 0;
  for (const f of findings) {
    const n = seen.get(f.code) || 0;
    seen.set(f.code, n + 1);
    total += POINTS[f.severity] * (n === 0 ? 1 : 0.5);
  }
  return total;
}

export const areaScore = (findings: HFinding[]) => Math.max(0, Math.round(100 - penalty(findings)));

export const worstOf = (findings: HFinding[]): Sev | null => findings.reduce<Sev | null>((w, f) => (w === null ? f.severity : worse(w, f.severity)), null);

export function statusOf(findings: HFinding[]): FindingStatus {
  const w = worstOf(findings);
  return w === 'critical' ? 'act' : w === 'major' ? 'watch' : w === 'minor' ? 'notes' : 'healthy';
}

export interface AreaRow { key: AreaKey; label: string; score: number; worst: Sev | null; critical: number; major: number; minor: number; info: number }

export function areaRows(findings: HFinding[], areas = AREAS): AreaRow[] {
  return areas.map((a) => {
    const fs = findings.filter((f) => f.area === a.key);
    const count = (s: Sev) => fs.filter((f) => f.severity === s).length;
    return { key: a.key, label: a.label, score: areaScore(fs), worst: worstOf(fs), critical: count('critical'), major: count('major'), minor: count('minor'), info: count('info') };
  });
}

/** the overall score: the mean of the area scores, capped by the worst severity present */
export function overallScore(findings: HFinding[], areas = AREAS): number {
  const rows = areaRows(findings, areas);
  const mean = Math.round(rows.reduce((a, r) => a + r.score, 0) / Math.max(1, rows.length));
  const w = worstOf(findings);
  const cap = w ? CAP[w] : undefined;
  return cap === undefined ? mean : Math.min(mean, cap);
}

const rank = (f: HFinding) => [SEV_ORDER.indexOf(f.severity), -(f.amount || 0), -(f.daysOpen || 0)];

/** the findings to put right first: worst severity, then money, then age; each with the points the overall score gains when it is fixed */
export function fixFirst(findings: HFinding[], n = 5): (HFinding & { recovers: number })[] {
  const base = overallScore(findings);
  return findings
    .filter((f) => f.severity !== 'info')
    .slice()
    .sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    })
    .slice(0, n)
    .map((f) => ({ ...f, recovers: Math.max(0, overallScore(findings.filter((x) => x !== f)) - base) }));
}

export interface Rollup { score: number; status: FindingStatus; areas: AreaRow[]; counts: Record<Sev, number>; fixFirst: (HFinding & { recovers: number })[] }

export function rollup(findings: HFinding[]): Rollup {
  const counts = { critical: 0, major: 0, minor: 0, info: 0 } as Record<Sev, number>;
  for (const f of findings) counts[f.severity]++;
  return { score: overallScore(findings), status: statusOf(findings), areas: areaRows(findings), counts, fixFirst: fixFirst(findings) };
}

// ---------------------------------------------------------------- turning existing facts into findings

/** the ratio checks of the old health score become findings only when they cross a threshold: under "hold below" is Major, under "healthy" is Minor */
export const CHECK_AREA: Record<string, { area: AreaKey; link: string; owner: string }> = {
  sales: { area: 'sales', link: '/secure/reports', owner: 'Business Head' },
  stock: { area: 'stock', link: '/secure/store/stock', owner: 'Store Head' },
  cash: { area: 'cash', link: '/secure/store/shifts', owner: 'Store Head' },
  purchasing: { area: 'purchasing', link: '/secure/purchases', owner: 'Business Head' },
  customers: { area: 'customers', link: '/secure/customers', owner: 'Store Head' },
  compliance: { area: 'compliance', link: '/secure/compliance', owner: 'Store Head' },
  service: { area: 'customers', link: '/secure/sales/deliveries', owner: 'Store Head' },
  dead_stock: { area: 'stock', link: '/secure/store/stock', owner: 'Business Head' },
  repeat: { area: 'customers', link: '/secure/customers', owner: 'Store Head' },
  returns: { area: 'sales', link: '/secure/sales/returns', owner: 'Store Head' },
  discount: { area: 'sales', link: '/secure/review', owner: 'Store Head' },
  approvals: { area: 'purchasing', link: '/secure/approvals', owner: 'Business Head' },
  refills: { area: 'customers', link: '/secure/refills', owner: 'Store Head' },
};

export function findingsFromChecks(
  checks: { key: string; label: string; score: number | null; on: boolean; fact?: string }[],
  t: { healthyMin: number; holdBelow: number },
): HFinding[] {
  const out: HFinding[] = [];
  for (const c of checks) {
    const m = CHECK_AREA[c.key];
    if (!m || !c.on || c.score === null || c.score >= t.healthyMin) continue;
    out.push({
      key: `measure:${c.key}`, code: `measure_${c.key}`, area: m.area, severity: c.score < t.holdBelow ? 'major' : 'minor', storeid: null,
      title: `${c.label} is at ${c.score} of 100`, detail: c.fact || '', link: m.link, owner: m.owner, legal: false,
    });
  }
  return out;
}

export interface Rule { area: AreaKey; severity: Sev; owner: string; legal?: boolean; link?: string }

/** how each alert code becomes a finding: its area, severity and owner (the alert's own wording and link are kept) */
export const ALERT_RULES: Record<string, Rule> = {
  licence_expired: { area: 'compliance', severity: 'critical', owner: 'Business Head', legal: true },
  licence_expiring: { area: 'compliance', severity: 'major', owner: 'Business Head', legal: true },
  registration_expired: { area: 'compliance', severity: 'critical', owner: 'Business Head', legal: true },
  registration_expiring: { area: 'compliance', severity: 'major', owner: 'Business Head', legal: true },
  gst_filing_late: { area: 'compliance', severity: 'critical', owner: 'Business Head', legal: true },
  gst_filing_due: { area: 'compliance', severity: 'major', owner: 'Business Head', legal: true },
  stock_count_never: { area: 'compliance', severity: 'major', owner: 'Store Head' },
  stock_count_overdue: { area: 'compliance', severity: 'major', owner: 'Store Head' },
  outage_kit_never: { area: 'compliance', severity: 'minor', owner: 'Store Head' },
  outage_kit_overdue: { area: 'compliance', severity: 'minor', owner: 'Store Head' },
  weekly_review_unsigned: { area: 'compliance', severity: 'minor', owner: 'Store Head' },
  compliance_escalated: { area: 'compliance', severity: 'critical', owner: 'Business Head', legal: true },
  compliance_parked: { area: 'compliance', severity: 'major', owner: 'Store Head' },
  shift_open_long: { area: 'cash', severity: 'major', owner: 'Store Head' },
  deposit_due_amount: { area: 'cash', severity: 'major', owner: 'Store Head' },
  deposit_due_schedule: { area: 'cash', severity: 'major', owner: 'Store Head' },
  deposit_due_amount_vault: { area: 'cash', severity: 'major', owner: 'Store Head' },
  deposit_due_schedule_vault: { area: 'cash', severity: 'major', owner: 'Store Head' },
  negative_stock: { area: 'stock', severity: 'major', owner: 'Store Head' },
  expired_stock: { area: 'stock', severity: 'major', owner: 'Store Head' },
  approvals_pending: { area: 'stock', severity: 'minor', owner: 'Store Head' },
  approvals_pending_one: { area: 'stock', severity: 'minor', owner: 'Store Head' },
  disposal_unconfirmed: { area: 'stock', severity: 'minor', owner: 'Store Head' },
  adjustment_other: { area: 'stock', severity: 'minor', owner: 'Store Head' },
  pricing_cuts: { area: 'sales', severity: 'critical', owner: 'Business Head', legal: true },
  pricing_raises: { area: 'sales', severity: 'minor', owner: 'Business Head' },
  pricing_unpriced: { area: 'sales', severity: 'major', owner: 'Business Head' },
  pricing_check: { area: 'stock', severity: 'info', owner: 'Business Head' },
};

/** the alert kinds the findings engine reads (the same queries the alerts engine runs, so nothing is worked out twice) */
export const ALERT_KINDS_USED = [
  'licence_expiring', 'registration_expiring', 'gst_filing_due', 'stock_count_overdue', 'outage_kit', 'weekly_review', 'compliance_late',
  'shift_open_long', 'deposit_due', 'negative_stock', 'expired_stock', 'approvals_pending', 'price_policy', 'disposal_unconfirmed', 'adjustment_other',
];

/** a shift left open this long is Critical, not just Major */
export const SHIFT_CRITICAL_HOURS = 24;

export interface AlertFinding { key: string; code: string; storeid: number | null; params: Record<string, any>; link: string; severity?: 'info' | 'warning' | 'critical' }

export function fromAlert(f: AlertFinding, text: { title: string; body: string }): HFinding | null {
  const r = ALERT_RULES[f.code];
  if (!r) return null;
  let severity = r.severity;
  // the alert may itself say Critical (an escalated item, a price cut); a shift open a day or more is Critical too
  if (f.severity === 'critical' && severity !== 'info') severity = 'critical';
  if (f.code === 'shift_open_long' && Number(f.params?.hours) >= SHIFT_CRITICAL_HOURS) severity = 'critical';
  const amount = Number(f.params?.value ?? f.params?.balance ?? f.params?.excess);
  return {
    key: `alert:${f.key}`, code: f.code, area: r.area, severity, storeid: f.storeid, store: f.params?.store ? String(f.params.store) : undefined,
    title: text.title, detail: text.body, count: f.params?.count !== undefined ? Number(f.params.count) : undefined,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null, link: f.link, owner: r.owner, legal: !!r.legal,
  };
}

/** a finding that is a legal duty is never below Major */
export const legalFloor = (f: HFinding): HFinding => (f.legal && (f.severity === 'minor' || f.severity === 'info') ? { ...f, severity: 'major' } : f);

/** the shift-variance finding: closed shifts with a drawer difference over the tolerance, and those closed without saying why */
export function varianceFinding(row: { store_id: number; location: string; shifts: number; total: number; unexplained: number }, minShiftsForMajor = 3): HFinding {
  const sev: Sev = row.shifts >= minShiftsForMajor ? 'major' : 'minor';
  return {
    key: `cash_variance:${row.store_id}`, code: 'cash_variance', area: 'cash', severity: sev, storeid: row.store_id, store: String(row.location).trim(),
    title: `Drawer differences at ${String(row.location).trim()}`,
    detail: `${row.shifts} shift${row.shifts === 1 ? '' : 's'} closed in the last 30 days with a cash or digital difference (Rs ${Math.round(row.total).toLocaleString('en-IN')} in all)${row.unexplained ? `, ${row.unexplained} with no reason given` : ''}.`,
    count: row.shifts, amount: Math.round(row.total), link: '/secure/store/shifts', owner: 'Store Head', legal: false,
  };
}

export interface MatrixRow { id: number; name: string; score: number; cells: Partial<Record<AreaKey, Sev | null>> }

/** the owner's store-by-area grid: the worst severity in each cell, plus each store's own score (findings with no store belong to the business, not to a row) */
export function storeMatrix(findings: HFinding[], stores: { id: number; name: string }[]): MatrixRow[] {
  return stores.map((s) => {
    const mine = findings.filter((f) => f.storeid === s.id);
    const cells: Partial<Record<AreaKey, Sev | null>> = {};
    for (const a of AREAS) cells[a.key] = worstOf(mine.filter((f) => f.area === a.key));
    return { id: s.id, name: s.name, score: overallScore(mine), cells };
  });
}

/** a snooze: the end date must be tomorrow or later and within 90 days, and a reason is needed (legal findings are refused by the caller) */
export function snoozeProblem(until: string, reason: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until || '')) return 'Pick the date the snooze ends.';
  if (until <= today) return 'The snooze must end after today.';
  if (daysBetween(today, until) > 90) return 'A snooze can last at most 90 days.';
  if (String(reason || '').trim().length < 3) return 'Say why it can wait.';
  return null;
}

/**
 * Per-business configuration of dashboards, compliance and recognition (RECOGNITION_AND_COMPLIANCE section 10).
 * Pure: no framework and no database, so the rules are unit tested. Relative imports only.
 *
 * Layers, most specific last: the system default, the default of the business type (and its pack), then the business's own
 * choice from a given date. A value is always held inside its floor: a locked key cannot be changed at all, a number stays
 * within min and max, and a choice is one of the listed options.
 */

export type ConfigScope = 'compliance' | 'recognition' | 'health' | 'views' | 'words';
export const CONFIG_SCOPES: ConfigScope[] = ['compliance', 'recognition', 'health', 'views', 'words'];

export interface ConfigDef {
  scope: ConfigScope;
  key: string;
  label: string;
  kind: 'int' | 'enum' | 'bool';
  default: number | string | boolean;
  /** a different default for some kinds of business, e.g. { general: 'Item' } */
  byType?: Record<string, number | string | boolean>;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  unit?: string;
  /** required by the law or the system: shown, never changed */
  locked?: boolean;
  /** only exists for businesses that have this pack */
  pack?: string;
}

const i = (scope: ConfigScope, key: string, label: string, def: number, min: number, max: number, unit: string, step = 1): ConfigDef =>
  ({ scope, key, label, kind: 'int', default: def, min, max, unit, step });
const e = (scope: ConfigScope, key: string, label: string, def: string, options: string[], byType?: Record<string, string>): ConfigDef =>
  ({ scope, key, label, kind: 'enum', default: def, options, byType });
const b = (scope: ConfigScope, key: string, label: string, def: boolean): ConfigDef => ({ scope, key, label, kind: 'bool', default: def });

export const CONFIG_DEFS: ConfigDef[] = [
  // the ladder: days after the due date at which each step starts
  i('compliance', 'stock_count_late_days', 'Stock count: days late before the store head is told', 3, 1, 7, 'days'),
  i('compliance', 'shift_close_required_days', 'An unclosed shift: days before opening a shift needs it closed or a reason', 1, 0, 3, 'days'),
  i('compliance', 'outage_late_days', 'Outage kit check: days late before the store head is told', 2, 1, 7, 'days'),
  i('compliance', 'review_late_days', 'Weekly review: days late before the Business Head is told', 2, 1, 7, 'days'),
  i('compliance', 'stock_count_required_days', 'Stock count: days late before closing a shift needs it done or a reason', 6, 1, 21, 'days'),
  i('compliance', 'escalate_days', 'Days late before the Business Head is told, for all items', 3, 1, 10, 'days'),
  i('compliance', 'waiver_max_days', 'Longest waiver the Business Head can grant', 7, 1, 30, 'days'),
  { ...b('compliance', 'block_expired_licence', 'Stop billing when the drug licence has ended (a waiver lifts it)', false), pack: 'pharmacy' },
  { scope: 'compliance', key: 'drug_register', label: 'Drug register entry', kind: 'enum', default: 'block', options: ['block'], locked: true, pack: 'pharmacy' },
  { scope: 'compliance', key: 'licence_expiry', label: 'Licence and registration expiry', kind: 'enum', default: 'escalate', options: ['escalate'], locked: true, pack: 'pharmacy' },

  // recognition: thresholds of habit badges (never raw sales or discount depth)
  i('recognition', 'till_streak', 'Accurate till: shifts in a row', 10, 3, 30, 'shifts'),
  i('recognition', 'capture_pct', 'Customer capture: share of bills with a mobile number', 95, 70, 100, '%'),
  i('recognition', 'refill_days', 'Refill caller: days running', 5, 2, 14, 'days'),
  i('recognition', 'handover_days', 'On-time handover: days', 14, 5, 30, 'days'),
  i('recognition', 'beat_days', 'Beat your usual: days in a week', 5, 3, 7, 'days'),
  i('recognition', 'clean_days', 'Compliance clean: days', 30, 7, 90, 'days'),
  b('recognition', 'till_on', 'Accurate till badge', true),
  b('recognition', 'capture_on', 'Customer capture badge', true),
  b('recognition', 'handover_on', 'On-time handover badge', true),
  b('recognition', 'beat_on', 'Beat your usual badge', true),
  b('recognition', 'clean_on', 'Compliance clean badge', true),
  { ...b('recognition', 'refill_on', 'Refill caller badge', true), pack: 'pharmacy' },

  // store health: weights add up to 100, and the safeguard threshold
  // each check: whether it counts, its weight (they add up to 100), and what it is measured by
  b('health', 'on_sales', 'Sales: include this check', true),
  i('health', 'w_sales', 'Sales: weight', 25, 0, 50, '%', 5),
  e('health', 'sales_basis', 'Sales: measured against', 'target or recent average', ['target or recent average', 'target', 'last month', 'same period last year', 'recent average', 'off']),
  i('health', 'recent_months', 'Sales: months in the recent average', 3, 1, 12, 'months'),
  b('health', 'on_stock', 'Stock: include this check', true),
  i('health', 'w_stock', 'Stock: weight', 15, 0, 50, '%', 5),
  e('health', 'stock_basis', 'Stock: judged by', 'products below their minimum', ['products below their minimum', 'products out of stock but selling', 'stock close to expiry']),
  i('health', 'stock_window_days', 'Stock: days of sales that count as selling', 30, 7, 90, 'days'),
  i('health', 'expiry_days', 'Stock: days ahead that count as close to expiry', 90, 30, 365, 'days'),
  b('health', 'on_cash', 'Cash and shifts: include this check', true),
  i('health', 'w_cash', 'Cash and shifts: weight', 15, 0, 50, '%', 5),
  i('health', 'cash_points_per_shift', 'Cash and shifts: points lost for each shift left open from an earlier day', 25, 5, 50, 'points', 5),
  i('health', 'cash_variance_points', 'Cash and shifts: points lost for each recent shift with a drawer difference (0 = not counted)', 0, 0, 25, 'points', 5),
  i('health', 'cash_tolerance', 'Cash and shifts: a drawer difference above this many rupees counts', 100, 0, 1000, 'rupees', 10),
  b('health', 'on_purchasing', 'Purchasing and payables: include this check', true),
  i('health', 'w_purchasing', 'Purchasing and payables: weight', 10, 0, 50, '%', 5),
  i('health', 'payables_grace_days', 'Purchasing and payables: days of grace before an unpaid invoice counts as overdue', 0, 0, 30, 'days'),
  b('health', 'on_customers', 'Customers: include this check', true),
  i('health', 'w_customers', 'Customers: weight', 10, 0, 50, '%', 5),
  i('health', 'customers_window_days', 'Customers: days of bills looked at (the mobile-number aim is set under Goals and badges)', 30, 7, 90, 'days'),
  b('health', 'on_compliance', 'Compliance: include this check', true),
  i('health', 'w_compliance', 'Compliance: weight', 15, 0, 50, '%', 5),
  i('health', 'compliance_late_points', 'Compliance: points lost for each late item', 10, 1, 25, 'points'),
  i('health', 'compliance_escalated_points', 'Compliance: points lost for each escalated item', 25, 1, 50, 'points'),
  b('health', 'on_service', 'Service and deliveries: include this check', true),
  i('health', 'w_service', 'Service and deliveries: weight', 10, 0, 50, '%', 5),
  i('health', 'service_window_days', 'Service and deliveries: days of deliveries looked at', 30, 7, 90, 'days'),
  // optional checks: off and weight 0 until the business chooses them (give one a weight and take the same from another, so the weights still add up to 100)
  b('health', 'on_dead_stock', 'Dead stock: include this check', false),
  i('health', 'w_dead_stock', 'Dead stock: weight (0 = not counted)', 0, 0, 50, '%', 5),
  i('health', 'dead_days', 'Dead stock: days without a sale that make stock dead', 90, 30, 365, 'days'),
  b('health', 'on_repeat', 'Repeat customers: include this check', false),
  i('health', 'w_repeat', 'Repeat customers: weight (0 = not counted)', 0, 0, 50, '%', 5),
  i('health', 'repeat_aim_pct', 'Repeat customers: share of known customers who should have bought again', 40, 5, 90, '%', 5),
  b('health', 'on_returns', 'Returns: include this check', false),
  i('health', 'w_returns', 'Returns: weight (0 = not counted)', 0, 0, 50, '%', 5),
  i('health', 'returns_max_pct', 'Returns: share of sales (30 days) that is fine to be returned', 3, 1, 20, '%'),
  b('health', 'on_discount', 'Discounts: include this check', false),
  i('health', 'w_discount', 'Discounts: weight (0 = not counted)', 0, 0, 50, '%', 5),
  i('health', 'discount_max_pct', 'Discounts: share of sales (30 days) that is fine to be given away', 5, 1, 30, '%'),
  b('health', 'on_approvals', 'Approvals waiting: include this check', false),
  i('health', 'w_approvals', 'Approvals waiting: weight (0 = not counted)', 0, 0, 50, '%', 5),
  i('health', 'approvals_wait_days', 'Approvals waiting: days a request may wait before it counts', 3, 1, 30, 'days'),
  i('health', 'approvals_points', 'Approvals waiting: points lost for each request waiting too long', 10, 1, 25, 'points'),
  { ...b('health', 'on_refills', 'Refill calls: include this check', false), pack: 'pharmacy' },
  { ...i('health', 'w_refills', 'Refill calls: weight (0 = not counted)', 0, 0, 50, '%', 5), pack: 'pharmacy' },
  { ...i('health', 'refill_calls_aim', 'Refill calls: calls recorded in a week that count as enough', 10, 1, 200, 'calls'), pack: 'pharmacy' },
  i('health', 'healthy_min', 'Healthy from a score of', 80, 60, 95, 'points'),
  i('health', 'hold_below', 'A check below this holds the store at Watch', 60, 40, 80, 'points'),

  // views
  e('views', 'amounts', 'Sales figures show', 'with GST', ['with GST', 'without GST']),
  e('views', 'default_period', 'Dashboard opens on', 'month to date', ['month to date', 'last 7 days', 'today']),
  b('views', 'new_menu', 'The grouped menu', false),

  // wording
  e('words', 'product_term', 'What a product is called', 'Medicine', ['Medicine', 'Item', 'Product'], { general: 'Item' }),
  e('words', 'customer_term', 'What a customer is called', 'Customer', ['Customer', 'Patient', 'Member']),
];

export type ConfigValue = number | string | boolean;
export interface ConfigRow { scope: string; key: string; value: ConfigValue; effective_from: string }
export interface ConfigItem extends ConfigDef {
  value: ConfigValue;
  defaultValue: ConfigValue;
  source: 'default' | 'business';
  since: string | null;
  planLocked: boolean;
  /** the next saved change that has not begun yet, so a change dated ahead is never invisible */
  pending: { value: ConfigValue; from: string } | null;
}

const find = (scope: string, key: string) => CONFIG_DEFS.find((d) => d.scope === scope && d.key === key);
export const defOf = find;

/** the default for a kind of business */
export const defaultOf = (d: ConfigDef, businessType: string): ConfigValue =>
  d.byType && d.byType[businessType] !== undefined ? d.byType[businessType] : d.default;

/** Returns an error sentence when the value is not allowed for the key, else null. */
export function checkValue(d: ConfigDef, v: any): string | null {
  if (d.locked) return `"${d.label}" is required and cannot be changed.`;
  if (d.kind === 'bool') return typeof v === 'boolean' ? null : `"${d.label}" must be on or off.`;
  if (d.kind === 'enum') return typeof v === 'string' && (d.options || []).includes(v) ? null : `"${d.label}" must be one of: ${(d.options || []).join(', ')}.`;
  if (typeof v !== 'number' || !Number.isInteger(v)) return `"${d.label}" must be a whole number.`;
  if (d.min !== undefined && v < d.min) return `"${d.label}" cannot be below ${d.min}.`;
  if (d.max !== undefined && v > d.max) return `"${d.label}" cannot be above ${d.max}.`;
  if (d.step && d.step > 1 && v % d.step !== 0) return `"${d.label}" moves in steps of ${d.step}.`;
  return null;
}

/** A scope as a whole must also make sense: the health weights add up to 100. */
export function checkScope(scope: ConfigScope, values: Record<string, ConfigValue>): string | null {
  if (scope === 'health') {
    const total = CONFIG_DEFS.filter((d) => d.scope === 'health' && d.key.startsWith('w_')).reduce((a, d) => a + Number(values[d.key] ?? d.default), 0);
    if (total !== 100) return `The health weights add up to ${total}, they must add up to 100.`;
    if (Number(values.hold_below ?? 60) >= Number(values.healthy_min ?? 80)) return 'The Watch safeguard must be below the Healthy score.';
  }
  return null;
}

/** Whether a key applies to this business: a pack-only key is hidden unless the business has the pack. */
export const applies = (d: ConfigDef, packs: string[]): boolean => !d.pack || packs.includes(d.pack);

/**
 * The effective settings of a business on a day: for each key the business's latest choice that has begun (effective_from
 * on or before the day), else the default of its type. A stored value that no longer passes its floor is ignored, so tightening
 * a rule in code never lets an old row weaken it. `planLocked` is a list of "scope" or "scope.key" the plan does not let the
 * business change.
 */
export function resolveConfig(opts: { scope?: ConfigScope; rows: ConfigRow[]; today: string; businessType: string; packs: string[]; planLocked?: string[] }): ConfigItem[] {
  const out: ConfigItem[] = [];
  for (const d of CONFIG_DEFS) {
    if (opts.scope && d.scope !== opts.scope) continue;
    if (!applies(d, opts.packs)) continue;
    const def = defaultOf(d, opts.businessType);
    const locked = (opts.planLocked || []).includes(d.scope) || (opts.planLocked || []).includes(`${d.scope}.${d.key}`);
    let value = def;
    let source: 'default' | 'business' = 'default';
    let since: string | null = null;
    if (!d.locked) {
      const mine = opts.rows
        .filter((r) => r.scope === d.scope && r.key === d.key && r.effective_from <= opts.today)
        .sort((a, c) => (a.effective_from < c.effective_from ? 1 : -1))[0];
      if (mine && checkValue(d, mine.value) === null) { value = mine.value; source = 'business'; since = mine.effective_from; }
    }
    const next = d.locked ? undefined : opts.rows
      .filter((r) => r.scope === d.scope && r.key === d.key && r.effective_from > opts.today && checkValue(d, r.value) === null)
      .sort((a, c) => (a.effective_from < c.effective_from ? -1 : 1))[0];
    out.push({ ...d, value, defaultValue: def, source, since, planLocked: locked, pending: next ? { value: next.value, from: next.effective_from } : null });
  }
  return out;
}

/** the effective settings of one scope as a plain key/value object */
export const asValues = (items: ConfigItem[]): Record<string, ConfigValue> => Object.fromEntries(items.map((x) => [x.key, x.value]));

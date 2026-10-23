/**
 * What each plan allows. Seeded into the `plan` table the first time the service starts, then edited there (price, limits and
 * modules can be changed without a release). Module keys and levels are the ones the pharmacy app understands
 * (api-v2/src/core/modules/modules.ts); purchasing is off, simple or full.
 */
export type PurchasingLevel = 'off' | 'simple' | 'full';

export interface ModuleSet {
  hr: boolean;
  purchasing: PurchasingLevel;
  gst: boolean;
  expenses: boolean;
  payment_recon: boolean;
  stock_audits: boolean;
  transfers: boolean;
}

export interface PlanDef {
  key: string;
  label: string;
  modules: ModuleSet;
  max_stores: number;
  max_users: number;
  price_month: number | null;
  sort: number;
}

export const DEFAULT_PLANS: PlanDef[] = [
  {
    key: 'starter', label: 'Starter (just me)', sort: 1, price_month: null, max_stores: 1, max_users: 2,
    modules: { hr: false, purchasing: 'simple', gst: false, expenses: false, payment_recon: false, stock_audits: false, transfers: false },
  },
  {
    key: 'shop', label: 'Shop (owner and staff)', sort: 2, price_month: null, max_stores: 1, max_users: 8,
    modules: { hr: false, purchasing: 'full', gst: false, expenses: true, payment_recon: true, stock_audits: true, transfers: false },
  },
  {
    key: 'chain', label: 'Chain (several stores)', sort: 3, price_month: null, max_stores: 10, max_users: 50,
    modules: { hr: true, purchasing: 'full', gst: true, expenses: true, payment_recon: true, stock_audits: true, transfers: true },
  },
];

export const MODULE_KEYS: Array<keyof ModuleSet> = ['hr', 'purchasing', 'gst', 'expenses', 'payment_recon', 'stock_audits', 'transfers'];

const LEVEL: Record<PurchasingLevel, number> = { off: 0, simple: 1, full: 2 };

/** The plan's modules with the tenant's own grants laid over them (a grant can switch a module on or off for one customer). */
export function effectiveModules(plan: ModuleSet, grants: Partial<Record<keyof ModuleSet, any>> | null): ModuleSet {
  const out: ModuleSet = { ...plan };
  for (const k of MODULE_KEYS) {
    const g = grants ? (grants as any)[k] : undefined;
    if (g === undefined || g === null) continue;
    if (k === 'purchasing') {
      if (g in LEVEL) out.purchasing = g;
    } else if (typeof g === 'boolean') {
      (out as any)[k] = g;
    }
  }
  if (out.purchasing === 'off') out.gst = false;       // GST reconciliation cannot outlive purchasing
  return out;
}

/** Checks a grants object sent by the admin; returns the cleaned object or an error text. */
export function checkGrants(g: any): { value?: Record<string, any>; error?: string } {
  if (g === null || g === undefined) return { value: {} };
  if (typeof g !== 'object' || Array.isArray(g)) return { error: 'Grants must be an object.' };
  const out: Record<string, any> = {};
  for (const k of Object.keys(g)) {
    if (!(MODULE_KEYS as string[]).includes(k)) return { error: `Unknown module "${k}".` };
    if (g[k] === null) continue;
    if (k === 'purchasing' ? !(g[k] in LEVEL) : typeof g[k] !== 'boolean') return { error: `Bad value for ${k}.` };
    out[k] = g[k];
  }
  return { value: out };
}

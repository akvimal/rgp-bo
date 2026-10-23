/**
 * Modules a business can switch on or off (OPERATING_MODES section 7). One definition drives the three places that
 * enforce it: the API (a switched-off module's endpoints answer 403), the permission list sent to the app (so menus,
 * buttons and routes disappear) and the schedulers.
 */
export type PurchasingLevel = 'off' | 'simple' | 'full';

export interface ModuleState {
  hr: boolean;
  purchasing: PurchasingLevel;
  gst: boolean;
  expenses: boolean;
  payment_recon: boolean;
  stock_audits: boolean;
  transfers: boolean;
}

export const MODULE_KEYS = ['hr', 'purchasing', 'gst', 'expenses', 'payment_recon', 'stock_audits', 'transfers'] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: 'HR and attendance',
  purchasing: 'Purchasing',
  gst: 'GST reconciliation',
  expenses: 'Expenses',
  payment_recon: 'Digital payment reconciliation',
  stock_audits: 'Stock audits',
  transfers: 'Stock transfers',
};

/** Everything on: what a business that never chose gets. */
export const ALL_ON: ModuleState = { hr: true, purchasing: 'full', gst: true, expenses: true, payment_recon: true, stock_audits: true, transfers: true };

const asBool = (v: any, dflt: boolean) => (v === undefined || v === null ? dflt : v === true || v === 'true');

/** The stored settings made whole: missing keys are on, and GST reconciliation cannot outlive purchasing. */
export function resolveModules(raw: any): ModuleState {
  const r = raw && typeof raw === 'object' ? raw : {};
  const purchasing: PurchasingLevel = r.purchasing === 'off' || r.purchasing === false ? 'off' : r.purchasing === 'simple' ? 'simple' : 'full';
  return {
    hr: asBool(r.hr, true),
    purchasing,
    gst: asBool(r.gst, true) && purchasing !== 'off',
    expenses: asBool(r.expenses, true),
    payment_recon: asBool(r.payment_recon, true),
    stock_audits: asBool(r.stock_audits, true),
    transfers: asBool(r.transfers, true),
  };
}

/** Checks what a Business Head sends; returns the settings to store (unknown keys are refused). */
export function parseModulesInput(body: any): { value: Partial<Record<ModuleKey, any>>; error?: string } {
  const out: Partial<Record<ModuleKey, any>> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { value: out, error: 'Send the modules as an object.' };
  for (const k of Object.keys(body)) {
    if (!(MODULE_KEYS as readonly string[]).includes(k)) return { value: out, error: `Unknown module "${k}".` };
    if (k === 'purchasing') {
      if (!['off', 'simple', 'full'].includes(body[k])) return { value: out, error: 'Purchasing must be off, simple or full.' };
    } else if (typeof body[k] !== 'boolean') {
      return { value: out, error: `${MODULE_LABELS[k as ModuleKey]} must be on or off.` };
    }
    out[k as ModuleKey] = body[k];
  }
  return { value: out };
}

interface Gate {
  key: ModuleKey;
  /** needs purchasing at this level */
  level?: 'full';
}

/** API path -> the module that owns it. Paths not listed are core and always on. */
const ROUTES: Array<[RegExp, Gate]> = [
  [/^\/(hr|my-hr|leave-approvals|kpi)(\/|$)/, { key: 'hr' }],
  [/^\/(purchases|purchaseitems|vendorpayments|vendor-issues|download)(\/|$)/, { key: 'purchasing' }],
  [/^\/(purchaseorders|purchaserequests|purchase-suggestions)(\/|$)/, { key: 'purchasing', level: 'full' }],
  [/^\/gst(\/|$)/, { key: 'gst' }],
  [/^\/expenses(\/|$)/, { key: 'expenses' }],
  [/^\/payment-recon(\/|$)/, { key: 'payment_recon' }],
  [/^\/(stock-audits|stock\/counts)(\/|$)/, { key: 'stock_audits' }],
  [/^\/store-stock-transfers(\/|$)/, { key: 'transfers' }],
];

/** Whether a path belongs to a switchable module at all (so most requests skip the lookup). */
export function gatedPath(path: string): boolean {
  return ROUTES.some(([re]) => re.test(path));
}

/** The reason a request must be refused, or null when its module is on (or it belongs to none). */
export function blockedBy(path: string, m: ModuleState): string | null {
  for (const [re, gate] of ROUTES) {
    if (!re.test(path)) continue;
    if (gate.key === 'purchasing') {
      if (m.purchasing === 'off') return `${MODULE_LABELS.purchasing} is switched off for this business.`;
      if (gate.level === 'full' && m.purchasing !== 'full') return 'Purchase requests and orders are not part of the simple purchasing this business uses.';
      return null;
    }
    return m[gate.key] ? null : `${MODULE_LABELS[gate.key]} is switched off for this business.`;
  }
  return null;
}

/** Permission resources that belong to a module: kept only while it is on. */
const RESOURCES: Record<string, (m: ModuleState) => boolean> = {
  hr: (m) => m.hr,
  myhr: (m) => m.hr,
  leaveapprove: (m) => m.hr,
  kpirate: (m) => m.hr,
  mykpi: (m) => m.hr,
  purchases: (m) => m.purchasing !== 'off',
  purchaseorders: (m) => m.purchasing === 'full',
  vendorissues: (m) => m.purchasing !== 'off',
  expenses: (m) => m.expenses,
  paymentrecon: (m) => m.payment_recon,
  stockaudit: (m) => m.stock_audits,
};

/** Single screens inside a shared resource. */
const PATHS: Array<[string, (m: ModuleState) => boolean]> = [
  ['/secure/store/transfers', (m) => m.transfers],
  ['/secure/purchases/orders', (m) => m.purchasing === 'full'],
  ['/secure/purchases/requests', (m) => m.purchasing === 'full'],
  ['/secure/purchases/suggestions', (m) => m.purchasing === 'full'],
  ['/secure/purchases/gst', (m) => m.gst],
];

/**
 * A role's permissions narrowed to what the business has switched on. The result goes to the app, which hides what is
 * missing; the stored role is never changed, so turning a module back on restores access at once.
 */
export function filterPermissions(permissions: any[], m: ModuleState): any[] {
  if (!Array.isArray(permissions)) return permissions;
  const off = (url: string) => PATHS.some(([prefix, on]) => !on(m) && (url === prefix || url.startsWith(prefix + '/')));
  const out: any[] = [];
  for (const p of permissions) {
    const keep = RESOURCES[p?.resource];
    if (keep && !keep(m)) continue;
    let entry = p;
    if (Array.isArray(p?.path)) {
      const paths = p.path.filter((u: string) => !off(u));
      if (paths.length !== p.path.length) {
        if (!paths.length) continue;
        entry = { ...p, path: paths };
      }
    } else if (typeof p?.path === 'string' && off(p.path)) {
      continue;
    }
    // simple purchasing: counter staff cannot raise purchase requests either
    if (entry.resource === 'purchases' && m.purchasing === 'simple' && Array.isArray(entry.policies)) {
      entry = { ...entry, policies: entry.policies.filter((x: any) => x?.action !== 'request') };
    }
    out.push(entry);
  }
  return out;
}

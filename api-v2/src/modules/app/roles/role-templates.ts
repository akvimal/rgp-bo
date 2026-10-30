import { Perm } from 'src/core/role-rules';

/**
 * Starter roles an owner can create in one click and then edit: the jobs of a shop that are not sales or the manager.
 * (The manager is the built-in Store Head, which carries staff management for its own stores; sales is the built-in Sales Staff.)
 * Pure data, in the shape the Roles screen stores.
 */
export interface RoleTemplate {
  name: string;
  blurb: string;
  permissions: any[];
}

const site = (...extra: string[]) => ({ resource: 'site', path: ['/secure/dashboard', '/secure/profile', ...extra] });
const one = (resource: string, path: string | string[], ...actions: string[]) => ({
  resource, path, policies: actions.map((action) => ({ action, properties: [] })),
});
/** every person sees their own HR and KPI pages and may ask for leave */
const self = () => [one('myhr', '/secure/my-hr', 'view', 'apply'), one('mykpi', '/secure/kpi/mine', 'view')];

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: 'Purchase Staff',
    blurb: 'Orders, invoices, vendors and stock. No sales, no accounts.',
    permissions: [
      site('/secure/purchases'),
      one('stock', '/secure/stock', 'read'),
      {
        resource: 'purchases', path: ['/secure/purchases', '/secure/purchases/vendors'],
        policies: [{ action: 'read', path: '/list', properties: [] }, { action: 'add', path: '/new', properties: [] }, { action: 'edit', path: '/edit', properties: [] }, { action: 'vendors.edit', path: 'vendors/edit', properties: [] }],
      },
      one('purchaseorders', ['/secure/purchases/orders']),
      one('vendorissues', '/secure/vendor-issues', 'view', 'add', 'return'),
      one('stockaudit', '/secure/stock-audits', 'view', 'perform'),
      ...self(),
    ],
  },
  {
    name: 'Accountant',
    blurb: 'Money in and out, bank and digital payments, GST filing and reports. No sales, no purchasing.',
    permissions: [
      site('/secure/finance'),
      one('finance', '/secure/finance', 'view'),
      one('expenses', '/secure/expenses', 'view', 'add', 'approve'),
      one('paymentrecon', '/secure/digital-payments', 'view', 'verify', 'import'),
      one('gstfiling', '/secure/gst-filing', 'view'),
      one('reports', ['/secure/reports']),
      ...self(),
    ],
  },
];

/** the templates an owner has not created yet (matched by role name) */
export function templatesToOffer(existingNames: string[]): RoleTemplate[] {
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return ROLE_TEMPLATES.filter((t) => !have.has(t.name.toLowerCase()));
}

export const templateByName = (name: string) => ROLE_TEMPLATES.find((t) => t.name === name);

/** a template is never more than an owner can give */
export const templatePerms = (t: RoleTemplate): Perm[] => t.permissions as Perm[];

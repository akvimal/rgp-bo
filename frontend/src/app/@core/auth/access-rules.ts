import registry from './permission-registry.json';

/**
 * The rules that decide what a login may see, kept pure (no Angular) so they are tested without the app. They read the permission registry
 * (`permission-registry.json`): which module a resource depends on, and which pages are open to everyone signed in.
 */

/** what the account knows about its plan and business, for the module checks */
export interface Plan {
  /** a hosted (SaaS) login: the platform-only resources are not offered */
  hosted: boolean;
  moduleOn: (key: string) => boolean;
  purchasingFull: boolean;
  feedbackOn: boolean;
}

const AVAILABILITY: Record<string, string> = {};
(registry.resources as Array<{ key: string; availability?: string }>).forEach((r) => { if (r.availability) AVAILABILITY[r.key] = r.availability; });

/** the module a resource depends on, or undefined when it is always offered */
export const availabilityOf = (resource: string): string | undefined => AVAILABILITY[resource];

/** whether a permission group means anything on this account: the plan's modules, and the platform-only ones */
export function resourceAvailableFor(resource: string, plan: Plan): boolean {
  const tag = AVAILABILITY[resource];
  switch (tag) {
    case undefined: return true;
    case 'platform': return !plan.hosted;
    case 'purchasing_full': return plan.purchasingFull;
    case 'feedback': return plan.feedbackOn;
    default: return plan.moduleOn(tag);     // hr, purchasing, expenses, payment_recon, stock_audits, refills, returns, drug_register, gst
  }
}

/** what a page rule needs to know about the login */
export interface PageContext {
  has: (action: string) => boolean;
  packOn: (pack: string) => boolean;
}

/** a role that opens or closes a shift, or manages other people's shifts */
const cashSide = (c: PageContext) => c.has('store.shift.open') || c.has('store.shift.close') || c.has('store.adjust');

/**
 * Pages whose access is not a path some role carries. `allow` decides; a url no rule matches is decided by the role's own paths.
 * `exact` matches the page only; otherwise the page and everything under it.
 */
const PAGE_RULES: Array<{ path: string; exact?: boolean; allow: (c: PageContext) => boolean }> = [
  // everyone signed in has their own notifications; what shows in them is decided by the server
  { path: '/secure/notifications', exact: true, allow: () => true },
  // the app guide is for everyone signed in; what it shows follows their login
  { path: '/secure/app-guide', exact: true, allow: () => true },
  // the help pages are for everyone signed in
  { path: '/secure/help', allow: () => true },
  // the weekly knowledge check is each person's own
  { path: '/secure/knowledge', exact: true, allow: () => true },
  // My follow-ups (the refill and call-back work): for whoever can read customers or work the refills; no role carries this path
  { path: '/secure/my-work', exact: true, allow: (c) => c.has('customers.read') || c.has('refills.view') },
  // the financial dashboard (money by category, cost ratios, cash, stock value): the same people the menu shows it to; no role carries this path
  { path: '/secure/financials', exact: true, allow: (c) => c.has('finance.view') || c.has('expenses.approve') },
  // Shifts, Cash and Vault share the Stock & Cash resource with the stock pages; they open only for a role that runs or manages a cash drawer
  { path: '/secure/store/shifts', allow: (c) => cashSide(c) },
  { path: '/secure/store/cash', allow: (c) => cashSide(c) },
  { path: '/secure/store/vault', allow: (c) => cashSide(c) },
  // the pharmacy guide is for everyone who works in a pharmacy business, whatever their role
  { path: '/secure/pharmacy-guide', exact: true, allow: (c) => c.packOn('pharmacy') },
];

/** true or false when a page rule decides the url (query and fragment already removed), null when the role's own paths do */
export function pageRuleDecides(url: string, ctx: PageContext): boolean | null {
  for (const rule of PAGE_RULES) {
    if (url === rule.path || (!rule.exact && url.startsWith(rule.path + '/'))) return rule.allow(ctx);
  }
  return null;
}

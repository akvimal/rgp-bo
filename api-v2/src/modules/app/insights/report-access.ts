import { Perm, grants } from 'src/core/role-rules';
import { isOwnerRole } from 'src/core/roles';

/**
 * Who may open which report (docs/planning/MENU_AND_PERMISSIONS.md, step D, Reports). The `reports` permission carries actions:
 *   sales      the sales report, and Ask the shop's sales, payment, expense and top-product reports
 *   purchases  Ask the shop's purchases by vendor
 *   stock      Ask the shop's expiring, expiry-risk and dead-stock reports
 *   margin     profit and thin-margin reports, customer dues and the weekly summary (what the owner reads)
 *   ask        the Ask the shop tab itself (the questions; each report in it still needs its own family)
 *   export     the sales report as a file
 * The owner roles always have all of them, whatever their saved permissions say; everyone else needs the grant. Pure, so the rule is tested
 * without a database.
 */
export const REPORT_ACTIONS = ['sales', 'purchases', 'stock', 'margin', 'ask', 'export'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** the family each Ask the shop report belongs to */
export const REPORT_FAMILY: Record<string, ReportAction> = {
  sales_summary: 'sales',
  sales_by_day: 'sales',
  sales_by_staff: 'sales',
  sales_by_store: 'sales',
  top_products: 'sales',
  payment_modes: 'sales',
  expenses: 'sales',
  purchases_by_vendor: 'purchases',
  expiring_stock: 'stock',
  expiry_risk: 'stock',
  dead_stock: 'stock',
  margin_by_product: 'margin',
  low_margin_products: 'margin',
  customer_dues: 'margin',
};

export function canDoReports(roleName: string | null | undefined, perms: Perm[], action: ReportAction): boolean {
  return isOwnerRole(roleName) || grants(perms, 'reports', action);
}

/** whether this person may open the report (the Ask the shop tab as well as the report's family) */
export function canOpenReport(roleName: string | null | undefined, perms: Perm[], reportKey: string): boolean {
  const family = REPORT_FAMILY[reportKey];
  return !!family && canDoReports(roleName, perms, 'ask') && canDoReports(roleName, perms, family);
}

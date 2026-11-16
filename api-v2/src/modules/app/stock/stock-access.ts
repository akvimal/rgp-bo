import { Perm, grants } from 'src/core/role-rules';
import { isOwnerRole } from 'src/core/roles';

/**
 * What the old `auditStock` gate opened, split into actions on the `store` permission (docs/planning/MENU_AND_PERMISSIONS.md, step D, Stock):
 *   qty.adjust         change stock quantities: adjustments, returns to stock, bulk changes, deleting an adjustment, raising an audit
 *   audit.approve      see the pending audits, approve, recount or reject one
 *   count.perform      start, fill in and submit a stock count, and see counts
 *   transfer.request   see store-to-store transfers, see what is available, dispatch one, cancel one
 *   transfer.receive   receive a transfer at the other store
 * The owner roles hold every action by name, whatever their saved permissions say. The Store Head is not let in by name: the grant decides
 * (migration 212 gave it every action). Pure, so it is tested without a database.
 */
export const STOCK_ACTIONS = ['qty.adjust', 'audit.approve', 'count.perform', 'transfer.request', 'transfer.receive'] as const;
export type StockAction = (typeof STOCK_ACTIONS)[number];

/** the prefix of the `@Permission(...)` value the guard reads, e.g. `@Permission('stockDo:qty.adjust')` */
export const STOCK_PERMISSION_PREFIX = 'stockDo:';

export const isStockAction = (a: string): a is StockAction => (STOCK_ACTIONS as readonly string[]).includes(a);

export function canDoStock(roleName: string | null | undefined, perms: Perm[], action: StockAction): boolean {
  return isOwnerRole(roleName) || grants(perms, 'store', action);
}

import { EntityManager } from 'typeorm';
import { Perm, grants, permsOf } from 'src/core/role-rules';
import { isOwnerRole } from 'src/core/roles';

/**
 * Till overrides that were decided by role name (docs/planning/MENU_AND_PERMISSIONS.md, step E, Sales), now actions on the `sales` permission
 * (void and forcevoid already were):
 *   batchstop.override    sell through a batch stop (an expired or blocked batch), which is then written to the audit log
 *   creditlimit.override  bill a customer on credit past their limit or while they have dues overdue
 *   deliveries.manage     change the delivery of a bill someone else rang up or whose shift is closed, and pay a delivery charge from another open shift
 *   returns.settings      set what a category does on return (free, inspected first, not accepted)
 * The owner roles hold each by name, whatever their saved permissions say. The Store Head does not: migration 216 gave it the first three.
 * Pure, so it is tested without a database. What is left as it was: billing, discounts, price overrides, credit sales, reprinting, returns and
 * exports have no keys of their own yet (the till would need every sales role to hold them), and a person's own-bills-only view is a data scope, not a permission.
 */
export const SALES_ACTIONS = ['batchstop.override', 'creditlimit.override', 'deliveries.manage', 'returns.settings'] as const;
export type SalesAction = (typeof SALES_ACTIONS)[number];

export function canDoSales(roleName: string | null | undefined, perms: Perm[], action: SalesAction): boolean {
  return isOwnerRole(roleName) || grants(perms, 'sales', action);
}

/** whether the signed-in person's role may do this: the services call it with their own manager and the token's role id */
export async function maySales(manager: EntityManager, user: any, action: SalesAction): Promise<boolean> {
  const [r] = await manager.query(`select name, permissions from app_role where id = $1`, [user?.roleid || 0]);
  return !!r && canDoSales(r.name, permsOf(r), action);
}

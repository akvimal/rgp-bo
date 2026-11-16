import { EntityManager } from 'typeorm';
import { Perm, grants, permsOf } from 'src/core/role-rules';
import { isOwnerRole } from 'src/core/roles';

/**
 * Customer actions that were decided by role name (docs/planning/MENU_AND_PERMISSIONS.md, step E, Customers), now actions on the `customers` permission:
 *   delete             delete or archive a customer (was a manager; the box was already in the role editor)
 *   merge              merge two customers, or two households
 *   creditlimit.set    set a customer's credit limit (was a manager)
 *   credit.correct     correct what a customer owes, or their store credit, with a reason (was the Business Head)
 *   households.manage  add and remove people in a household (was a manager)
 *   followup.wording   change the follow-up message wording (was a manager)
 *   relationships.setup  change the active-customer and contact-cap settings (was the Business Head)
 * Seeing full contact details (`reveal`) and downloading lists (`export`) already had grants and are as before. The owner roles hold every action by
 * name, whatever their saved permissions say; the Store Head does not (migration 215 gave it the manager-level ones). Pure rule, tested without a database.
 */
export const CUSTOMER_ACTIONS = ['delete', 'merge', 'creditlimit.set', 'credit.correct', 'households.manage', 'followup.wording', 'relationships.setup'] as const;
export type CustomerAction = (typeof CUSTOMER_ACTIONS)[number];

export function canDoCustomers(roleName: string | null | undefined, perms: Perm[], action: CustomerAction): boolean {
  return isOwnerRole(roleName) || grants(perms, 'customers', action);
}

/** whether the signed-in person's role may do this: the services call it with their own manager and the token's role id */
export async function mayCustomers(manager: EntityManager, user: any, action: CustomerAction): Promise<boolean> {
  const [r] = await manager.query(`select name, permissions from app_role where id = $1`, [user?.roleid || 0]);
  return !!r && canDoCustomers(r.name, permsOf(r), action);
}

import { Perm, grants } from 'src/core/role-rules';
import { isOwnerRole } from 'src/core/roles';

/**
 * Who may use Customer orders (docs/planning/MENU_AND_PERMISSIONS.md, step A). The page used to ride on `sales`; it has its own permission now:
 *   view   = see the orders, take one, take an advance, collect it on a bill (what the till did before)
 *   manage = what only a Store Head or the owner could do: pay an advance back, cancel an order
 * The owner roles always have both, whatever their saved permissions say; everyone else needs the grant.
 */
export function canUseCustomerOrders(roleName: string | null | undefined, perms: Perm[]): boolean {
  return isOwnerRole(roleName) || grants(perms, 'customerorders', 'view') || grants(perms, 'customerorders', 'manage');
}

export function canManageCustomerOrders(roleName: string | null | undefined, perms: Perm[]): boolean {
  return isOwnerRole(roleName) || grants(perms, 'customerorders', 'manage');
}

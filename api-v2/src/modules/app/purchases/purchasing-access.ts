import { Perm, grants } from 'src/core/role-rules';
import { isOwnerRole, ROLE } from 'src/core/roles';

/**
 * The sensitive purchasing actions, each its own action on the `purchases` permission (docs/planning/MENU_AND_PERMISSIONS.md, step D, Purchasing):
 *   payments.view            see the payments made on an invoice
 *   payments.record          record a payment, a pay run, or change a payment
 *   payments.reverse         reverse a payment
 *   returns.manage           record a vendor return, and take a credit on or off an invoice
 *   invoices.editcompleted   change an invoice that is already complete (its header, lines, deleting it)
 *   invoices.approvepay      approve an invoice for payment, withdraw an approval, and change the rule
 *   invoices.recalculate     check and correct invoice totals and line totals
 * The owner roles and the platform admin hold every one by name, whatever their saved permissions say; everyone else needs the grant. The
 * everyday actions (read, add, edit, delete, request, vendors.edit) are as before. Pure, so it is tested without a database.
 */
export const PURCHASING_ACTIONS = [
  'payments.view', 'payments.record', 'payments.reverse', 'returns.manage', 'invoices.editcompleted', 'invoices.approvepay', 'invoices.recalculate',
] as const;
export type PurchasingAction = (typeof PURCHASING_ACTIONS)[number];

export const isSensitivePurchasingAction = (action: string): action is PurchasingAction => (PURCHASING_ACTIONS as readonly string[]).includes(action);

export function canDoPurchasing(roleName: string | null | undefined, perms: Perm[], action: PurchasingAction): boolean {
  return isOwnerRole(roleName) || roleName === ROLE.SITE_ADMIN || grants(perms, 'purchases', action);
}

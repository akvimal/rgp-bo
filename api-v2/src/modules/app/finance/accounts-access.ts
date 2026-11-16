import { Perm, grants } from 'src/core/role-rules';
import { isOwnerRole } from 'src/core/roles';

/**
 * Finance and GST filing were one presence check each; now they carry actions (docs/planning/MENU_AND_PERMISSIONS.md, step E, Accounts):
 *   finance     view (reads; the page opens), bank.import (bank accounts, statement preview and import), reconcile (tag lines, remove rules, sign a month off
 *               or reopen it), records (the records check and attesting it)
 *   gstfiling   view (reads: rate changes, registers, summaries, months), prepare (rate changes, HSN, supply kinds, the registration), export (the
 *               register, report and pack as files), lock (close a month), unlock (reopen a closed month)
 * `view` stays what it was: holding the resource opens the pages. Every other action is the grant; the owner roles hold all of them by name.
 * (GST reconciliation, the `gst` resource, and Digital payments already had enforced actions and are as before.) Pure, so it is tested without a database.
 */
export const FINANCE_ACTIONS = ['bank.import', 'reconcile', 'records'] as const;
export const GSTFILING_ACTIONS = ['prepare', 'export', 'lock', 'unlock'] as const;
export type FinanceAction = 'view' | (typeof FINANCE_ACTIONS)[number];
export type GstFilingAction = 'view' | (typeof GSTFILING_ACTIONS)[number];

const holds = (perms: Perm[], resource: string) => perms.some((p) => p.resource === resource);

export function canDoFinance(roleName: string | null | undefined, perms: Perm[], action: FinanceAction): boolean {
  if (isOwnerRole(roleName)) return true;
  return action === 'view' ? holds(perms, 'finance') : grants(perms, 'finance', action);
}

export function canDoGstFiling(roleName: string | null | undefined, perms: Perm[], action: GstFilingAction): boolean {
  if (isOwnerRole(roleName)) return true;
  return action === 'view' ? holds(perms, 'gstfiling') : grants(perms, 'gstfiling', action);
}

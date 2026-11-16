import { Perm, grants } from 'src/core/role-rules';
import { isOwnerRole, ROLE } from 'src/core/roles';

/**
 * Setup actions that were the owner roles by name only (docs/planning/MENU_AND_PERMISSIONS.md, step E, Setup). Three sit on the Business Details
 * permission (`businessprofile`), which already carries the pages they live on (shop setup, import and export), one on `users`:
 *   businessprofile  modules.manage   switch modules on or off, and preview or apply a setup preset
 *   businessprofile  transfer.export  export the business setup (JSON, Excel, the blank template)
 *   businessprofile  transfer.import  read, preview and apply an imported business setup
 *   users            mfareset         unlink someone's authenticator (a lost phone)
 * The owner roles hold each by name, whatever their saved permissions say; everyone else needs the grant. Editing the business details themselves
 * is unchanged. There is no admin password reset in the app (a person changes their own), so there is no `users.resetpassword`. Pure, so it is
 * tested without a database.
 */
export const SETUP_ACTIONS = ['modules.manage', 'transfer.export', 'transfer.import', 'mfareset'] as const;
export type SetupAction = (typeof SETUP_ACTIONS)[number];

/** the permission each action lives on */
export const SETUP_RESOURCE: Record<SetupAction, string> = {
  'modules.manage': 'businessprofile',
  'transfer.export': 'businessprofile',
  'transfer.import': 'businessprofile',
  mfareset: 'users',
};

export function canDoSetup(roleName: string | null | undefined, perms: Perm[], action: SetupAction): boolean {
  return isOwnerRole(roleName) || (action === 'mfareset' && roleName === ROLE.SITE_ADMIN) || grants(perms, SETUP_RESOURCE[action], action);
}

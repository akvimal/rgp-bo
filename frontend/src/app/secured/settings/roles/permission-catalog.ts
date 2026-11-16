export interface PermissionProperty {
  key: string;
  label: string;
}

export interface PermissionAction {
  key: string;
  label: string;
  hint?: string;
  properties?: PermissionProperty[];
  /** the grant may carry a scope (store or business): how much of the screen's records it reaches */
  scoped?: boolean;
  fixedProperties?: string[];
}

export interface PermissionResource {
  key: string;
  label: string;
  description: string;
  group: string;
  path: string | string[];
  settingsPath?: boolean;
  presenceOnly?: boolean;
  bundle?: boolean;
  bundleLabel?: string;
  pathOptions?: PermissionProperty[];
  /** the business module (or platform setting) this resource depends on; absent = always offered (see access-rules.ts) */
  availability?: string;
  actions: PermissionAction[];
}

/**
 * The role editor's catalogue is a typed view of the permission registry (`@core/auth/permission-registry.json`): one list of every resource, its
 * actions, group, page paths and the module it depends on. The menu, the route check and the role editor read the same data, and the API's own
 * checks are compared with it by a test (api-v2 `permission-registry.spec.ts`), so a permission cannot exist in one place only.
 */
import registry from '../../../@core/auth/permission-registry.json';

export const PERMISSION_GROUPS: string[] = registry.groups;

export const PERMISSION_CATALOG: PermissionResource[] = registry.resources as unknown as PermissionResource[];

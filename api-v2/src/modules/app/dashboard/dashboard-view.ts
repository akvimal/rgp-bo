/**
 * Which dashboard view a role gets and which widgets it holds, in order (DASHBOARD_AND_MENU_DESIGN 3.1 and 6A).
 * Pure: relative imports only. The widget keys are the registry the page renders; a widget a role may not see is absent from its list,
 * so the server's list and the page agree. Data gates (cost and margin owner only, no customer names) stay in the data queries.
 */
import { ROLE } from '../../../core/roles';

export type DashView = 'owner' | 'manager' | 'staff' | 'counter' | 'personal' | 'platform';

export const VIEW_OF_ROLE: Record<string, DashView> = {
  [ROLE.BUSINESS_HEAD]: 'owner',
  [ROLE.OWNER_OPERATOR]: 'owner',
  [ROLE.STORE_HEAD]: 'manager',
  [ROLE.SALES_STAFF]: 'staff',
  [ROLE.COUNTER]: 'counter',
  [ROLE.PERSONAL]: 'personal',
  [ROLE.SITE_ADMIN]: 'platform',
};

export const viewForRole = (roleName: string | null | undefined): DashView => VIEW_OF_ROLE[String(roleName)] ?? 'manager';

/** the standard order of the page (6A): needs-you-now, hero, tiles, then the role's cards */
export const WIDGETS: Record<DashView, string[]> = {
  owner: ['needs', 'tiles', 'sales-trend', 'cash', 'purchasing', 'stock', 'customers', 'products', 'staff'],
  manager: ['needs', 'tiles', 'sales-trend', 'cash', 'stock', 'customers', 'products', 'staff'],
  staff: ['needs', 'my-day', 'goals', 'badges', 'notes'],
  counter: ['needs', 'shift', 'goals', 'store-today'],
  personal: ['needs', 'attendance', 'leave', 'badges'],
  platform: ['platform'],
};

export const widgetsFor = (view: DashView): string[] => WIDGETS[view].slice();

/** views that carry cost, margin or other owner-only figures */
export const OWNER_ONLY_WIDGETS = ['purchasing', 'margin'];

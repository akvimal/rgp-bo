import { Perm, grants } from 'src/core/role-rules';
import { isOwnerRole } from 'src/core/roles';

/**
 * Who may do what in HR (docs/planning/MENU_AND_PERMISSIONS.md, step D, HR). The `hr` permission carries one action per area:
 *   staff.view / staff.manage      the staff records, positions and the starter set; hiring, leaving, rejoining, linking a login
 *   pay.view / pay.manage          salary revisions, pay components and bank details
 *   payroll.view / .run / .approve the monthly runs and pay stubs; editing and generating a run; approving and reopening it
 *   attendance.manage              the attendance grid and marking days
 *   leave.manage                   leave types, balances, requests and decisions, and the holiday list
 *   kpi.setup                      KPI measures, bands, scoring, finalising, and the role assistant
 *   bonus.manage                   bonuses
 * `hr.view` (kept) opens the HR pages; each tab also needs its own action. The owner roles always hold every action, whatever their saved
 * permissions say; everyone else needs the grant. A route no rule names is open to the owner roles only. Pure, so it is tested without a database.
 */
export const HR_ACTIONS = [
  'staff.view', 'staff.manage', 'pay.view', 'pay.manage', 'payroll.view', 'payroll.run', 'payroll.approve',
  'attendance.manage', 'leave.manage', 'kpi.setup', 'bonus.manage',
] as const;
export type HrAction = (typeof HR_ACTIONS)[number];

type Rule = { method: string; path: RegExp; action: HrAction };
const r = (method: string, path: string, action: HrAction): Rule => ({ method, path: new RegExp(`^/hr/${path}$`), action });

/** the routes of HrController (path after /hr, with :params), in the order they are tried; the first match decides */
const RULES: Rule[] = [
  // pay first: they sit under staff/:id and components
  r('GET', 'staff/:id/accounts', 'pay.view'),
  r('PUT', 'staff/:id/accounts', 'pay.manage'),
  r('POST', 'staff/:id/revisions', 'pay.manage'),
  r('DELETE', 'revisions/:id', 'pay.manage'),
  r('GET', 'components', 'pay.view'),
  r('POST', 'components', 'pay.manage'),
  r('PUT', 'components/:id', 'pay.manage'),
  r('DELETE', 'components/:id', 'pay.manage'),
  // staff
  r('GET', 'staff', 'staff.view'),
  r('GET', 'staff/candidates', 'staff.view'),
  r('GET', 'staff/:id', 'staff.view'),
  r('GET', 'stores', 'staff.view'),
  r('GET', 'roles', 'staff.view'),
  r('GET', 'positions', 'staff.view'),
  r('GET', 'positions/designations', 'staff.view'),
  r('GET', 'starter', 'staff.view'),
  r('POST', 'staff', 'staff.manage'),
  r('PUT', 'staff/:id', 'staff.manage'),
  r('DELETE', 'staff/:id', 'staff.manage'),
  r('POST', 'staff/:id/exit', 'staff.manage'),
  r('POST', 'staff/:id/login', 'staff.manage'),
  r('POST', 'staff/:id/rejoin', 'staff.manage'),
  r('PUT', 'statutory/:code', 'staff.manage'),
  r('POST', 'positions', 'staff.manage'),
  r('PUT', 'positions/:id', 'staff.manage'),
  r('DELETE', 'positions/:id', 'staff.manage'),
  r('POST', 'positions/designations', 'staff.manage'),
  r('POST', 'starter', 'staff.manage'),
  // payroll
  r('GET', 'payroll', 'payroll.view'),
  r('GET', 'payroll/stub/:lineId', 'payroll.view'),
  r('GET', 'payroll/:period', 'payroll.view'),
  r('GET', 'payroll/:period/attendance-hold', 'payroll.view'),
  r('GET', 'payroll/:period/export', 'payroll.view'),
  r('PUT', 'payroll/lines/:id', 'payroll.run'),
  r('POST', 'payroll/:period/generate', 'payroll.run'),
  r('POST', 'payroll/:period/approve', 'payroll.approve'),
  r('POST', 'payroll/:period/reopen', 'payroll.approve'),
  // attendance, leave and holidays
  r('GET', 'attendance', 'attendance.manage'),
  r('PUT', 'attendance', 'attendance.manage'),
  r('GET', 'leave/types', 'leave.manage'),
  r('POST', 'leave/types', 'leave.manage'),
  r('PUT', 'leave/types/:id', 'leave.manage'),
  r('DELETE', 'leave/types/:id', 'leave.manage'),
  r('GET', 'leave/balances', 'leave.manage'),
  r('GET', 'leave/requests', 'leave.manage'),
  r('POST', 'leave/requests', 'leave.manage'),
  r('POST', 'leave/requests/:id/decision', 'leave.manage'),
  r('GET', 'holidays', 'leave.manage'),
  r('POST', 'holidays', 'leave.manage'),
  r('DELETE', 'holidays/:date', 'leave.manage'),
  // bonuses
  r('GET', 'bonuses', 'bonus.manage'),
  r('POST', 'bonuses/preview', 'bonus.manage'),
  r('POST', 'bonuses', 'bonus.manage'),
  r('POST', 'bonuses/item', 'bonus.manage'),
  r('PUT', 'bonuses/items/:id', 'bonus.manage'),
  r('DELETE', 'bonuses/items/:id', 'bonus.manage'),
  // KPI and the role assistant
  r('GET', 'kpi/system-measures', 'kpi.setup'),
  r('GET', 'kpi/metrics', 'kpi.setup'),
  r('POST', 'kpi/metrics', 'kpi.setup'),
  r('PUT', 'kpi/metrics/:id', 'kpi.setup'),
  r('DELETE', 'kpi/metrics/:id', 'kpi.setup'),
  r('GET', 'kpi/templates', 'kpi.setup'),
  r('POST', 'kpi/templates/apply', 'kpi.setup'),
  r('GET', 'kpi/bands', 'kpi.setup'),
  r('PUT', 'kpi/bands', 'kpi.setup'),
  r('POST', 'kpi/bands/reset', 'kpi.setup'),
  r('GET', 'kpi/month', 'kpi.setup'),
  r('POST', 'kpi/score', 'kpi.setup'),
  r('POST', 'kpi/override', 'kpi.setup'),
  r('POST', 'kpi/finalise', 'kpi.setup'),
  r('POST', 'kpi/reopen', 'kpi.setup'),
  r('POST', 'kpi/todos', 'kpi.setup'),
  r('GET', 'ai/status', 'kpi.setup'),
  r('GET', 'ai/roles', 'kpi.setup'),
  r('PUT', 'ai/ceiling', 'kpi.setup'),
  r('POST', 'ai/role/draft', 'kpi.setup'),
  r('POST', 'ai/role/save', 'kpi.setup'),
  r('POST', 'ai/kpis/draft', 'kpi.setup'),
  r('POST', 'ai/kpis/apply', 'kpi.setup'),
  r('POST', 'ai/bands/draft', 'kpi.setup'),
  r('POST', 'ai/bands/simulate', 'kpi.setup'),
  r('POST', 'ai/bands/apply', 'kpi.setup'),
];

/** the action a request needs: the method and the route as Nest registered it ('/hr/staff/:id'); null when no rule names it (owner roles only) */
export function hrActionFor(method: string, routePath: string): HrAction | null {
  const m = String(method || '').toUpperCase();
  const p = String(routePath || '').replace(/\/+$/, '');
  return RULES.find((x) => x.method === m && x.path.test(p))?.action ?? null;
}

export function canDoHr(roleName: string | null | undefined, perms: Perm[], action: HrAction): boolean {
  return isOwnerRole(roleName) || grants(perms, 'hr', action);
}

/** a request is allowed when the role holds the action its route needs; an unnamed route is for the owner roles only */
export function canUseHrRoute(roleName: string | null | undefined, perms: Perm[], method: string, routePath: string): boolean {
  const action = hrActionFor(method, routePath);
  return action ? canDoHr(roleName, perms, action) : isOwnerRole(roleName);
}

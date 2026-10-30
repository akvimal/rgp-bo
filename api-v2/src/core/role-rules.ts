import { MANAGER_ROLES, OWNER_ROLES, ROLE } from './roles';

/**
 * Who may build a role, and who may be given which. Pure: the services pass in what they loaded.
 * An owner builds roles freely (anything in the catalogue except what only the platform holds); a manager can only hand out what they hold
 * themselves, so a role can never be a way to more access than the person making it has.
 */
export type Perm = { resource?: string; policies?: { action?: string }[] };

/** roles only the platform admin sets up: the first login of a business */
export const RESERVED_ROLES: string[] = [ROLE.BUSINESS_HEAD, ROLE.OWNER_OPERATOR, ROLE.SITE_ADMIN];

/** the lower built-in roles a manager may give to staff (no peers, no owners) */
export const MANAGER_CAN_GIVE: string[] = [ROLE.SALES_STAFF, ROLE.COUNTER, ROLE.PERSONAL];

/** catalogue resources that belong to the platform, not to any business */
export const PLATFORM_ONLY: string[] = ['businesses'];

export function permsOf(role: { permissions?: any } | null | undefined): Perm[] {
  let p: any = role?.permissions;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { p = []; }
  }
  return Array.isArray(p) ? p : [];
}

export function grants(perms: Perm[], resource: string, action: string): boolean {
  return perms.some((p) => p.resource === resource && (p.policies || []).some((x) => x.action === action));
}

const isOwner = (name?: string | null) => !!name && OWNER_ROLES.includes(name);
const isSiteAdmin = (name?: string | null) => name === ROLE.SITE_ADMIN;
export const isManagerOnly = (name?: string | null) => !!name && MANAGER_ROLES.includes(name) && !OWNER_ROLES.includes(name);

/** what a role would give that the person giving it does not hold ("resource.action"); empty means it is theirs to give */
export function overreach(giverRole: string | null | undefined, giverPerms: Perm[], newPerms: Perm[]): string[] {
  if (isSiteAdmin(giverRole)) return [];
  const out: string[] = [];
  for (const p of newPerms) {
    if (!p.resource) continue;
    if (PLATFORM_ONLY.includes(p.resource)) { out.push(p.resource); continue; }
    if (isOwner(giverRole)) continue;
    for (const x of p.policies || []) if (x.action && !grants(giverPerms, p.resource, x.action)) out.push(`${p.resource}.${x.action}`);
  }
  return out;
}

/** a message when this person may not give this role to staff, else null. `custom` is a role an owner built (not one of the built-in names). */
export function roleBlock(giverRole: string | null | undefined, targetRole: string, builtIn: boolean): string | null {
  if (RESERVED_ROLES.includes(targetRole)) return `${targetRole} is set up by your platform administrator, not from here.`;
  if (isSiteAdmin(giverRole) || isOwner(giverRole)) return null;
  if (MANAGER_ROLES.includes(targetRole)) return 'A manager cannot give the manager role. Ask the owner.';
  if (builtIn && !MANAGER_CAN_GIVE.includes(targetRole)) return `A manager cannot give the ${targetRole} role.`;
  return null;
}

/** the stores a manager changes for someone: only their own are touched, any store of the person's outside them is kept */
export function mergeStores(current: number[], managerStores: number[], requested: number[]): number[] {
  const mine = new Set(managerStores);
  const kept = current.filter((s) => !mine.has(s));
  return [...requested, ...kept.filter((s) => !requested.includes(s))];
}

export const sharesStore = (a: number[], b: number[]) => a.some((s) => b.includes(s));

import { EntityManager } from 'typeorm';
import { Perm, permsOf } from './role-rules';
import { isOwnerRole } from './roles';

/**
 * Scope on the grant (docs/planning/MENU_AND_PERMISSIONS.md, scope step). A policy may carry a `scope` saying how much it applies to:
 *   store     the stores the person works at (and what they raised or are assigned)
 *   business  every store of the business
 * A policy with no scope behaves as the screen always did (the legacy scope: the owner roles see the business, the Store Head their stores,
 * staff their own records), so nothing changed for any existing role. A scope only widens: it never narrows a person below what the screen already gave.
 * The owner roles are the business whatever their saved permissions say. Which screens read it is up to each service; today the view of Expenses,
 * Vendor issues, Inquiries and Digital payments. Pure, so it is tested without a database.
 */
export type Scope = 'own' | 'store' | 'business';
export const GRANT_SCOPES = ['store', 'business'] as const;
export type GrantScope = (typeof GRANT_SCOPES)[number];

const RANK: Record<Scope, number> = { own: 0, store: 1, business: 2 };
export const scopeRank = (s: Scope | string | null | undefined): number => (s && s in RANK ? RANK[s as Scope] : -1);
export const isGrantScope = (s: any): s is GrantScope => (GRANT_SCOPES as readonly string[]).includes(s);

/** the widest explicit scope a role's policies carry for this action, or null when none is written */
export function grantedScope(perms: Perm[], resource: string, action: string): GrantScope | null {
  let best: GrantScope | null = null;
  for (const p of perms) {
    if (p.resource !== resource) continue;
    for (const x of p.policies || []) {
      if (x.action !== action || !isGrantScope(x.scope)) continue;
      if (best === null || scopeRank(x.scope) > scopeRank(best)) best = x.scope;
    }
  }
  return best;
}

/** how much a person sees through this action: the owner roles the business; else the explicit scope if it is wider than the legacy one; else the legacy one */
export function effectiveScope(roleName: string | null | undefined, perms: Perm[], resource: string, action: string, legacy: Scope): Scope {
  if (isOwnerRole(roleName)) return 'business';
  const g = grantedScope(perms, resource, action);
  return g !== null && scopeRank(g) > scopeRank(legacy) ? g : legacy;
}

/** the scope of the signed-in person's role for this action; `legacy` is what the screen gave a role of that name before scope existed */
export async function scopeOf(manager: EntityManager, user: any, resource: string, action: string, legacy: (roleName: string) => Scope): Promise<{ role: string; scope: Scope }> {
  const [r] = await manager.query(`select name, permissions from app_role where id = $1`, [user?.roleid || 0]);
  const role = r?.name || '';
  return { role, scope: effectiveScope(role, permsOf(r), resource, action, legacy(role)) };
}

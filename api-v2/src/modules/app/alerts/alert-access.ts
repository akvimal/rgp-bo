import { ROLE } from '../../../core/roles';

/** may this person see a notification of a rule: named by the rule (their kind of role, or themselves) and at one of its stores */
export function canSee(recipients: any, who: { id: number; role: string; owner: boolean; storeIds: number[] }, storeId: number | null): boolean {
  const roles: string[] = recipients?.roles || [];
  const ids: number[] = recipients?.userids || [];
  const manager = who.role === ROLE.STORE_HEAD;
  const named = (roles.includes('owners') && who.owner) || (roles.includes('managers') && manager) || (roles.includes('staff') && !who.owner && !manager) || ids.includes(who.id);
  if (!named) return false;
  if (who.owner || storeId === null) return true;
  return who.storeIds.length === 0 || who.storeIds.includes(storeId);
}

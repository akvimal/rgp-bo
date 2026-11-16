import { EntityManager } from 'typeorm';
import { businessOfUser } from './business-of-user';
import { OWNER_ROLES } from './roles';

/**
 * Which stores a person may read data of: the stores of their business for an owner role, the stores they are assigned to for anyone else (or the
 * business's stores when none are assigned). `null` means no limit and is only for a login with no business at all (the platform's own); an empty
 * list means nothing. Pure, so the rule is tested without a database.
 */
export function pickStores(input: { owner: boolean; inBusiness: number[] | null; assigned: number[] }): number[] | null {
  if (input.inBusiness === null) return null;
  if (input.owner) return input.inBusiness;
  const mine = input.assigned.filter((id) => (input.inBusiness as number[]).includes(id));
  return mine.length ? mine : input.inBusiness;
}

export async function storesVisibleTo(manager: EntityManager, userId: number): Promise<{ stores: number[] | null; businessId: number | null; owner: boolean }> {
  const id = Number(userId) || 0;
  const [role] = await manager.query(`select r.name from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [id]);
  const owner = OWNER_ROLES.includes(role?.name);
  const businessId = await businessOfUser(manager, id);
  if (!businessId) return { stores: null, businessId: null, owner };
  const inBusiness = (await manager.query(`select id from stores where business_id = $1 and active and not archive`, [businessId])).map((r: any) => +r.id);
  const assigned = (await manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [id])).map((r: any) => +r.store_id);
  return { stores: pickStores({ owner, inBusiness, assigned }), businessId, owner };
}

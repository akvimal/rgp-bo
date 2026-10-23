import { EntityManager } from 'typeorm';

/**
 * The business a user works in: the one on their account (owners and the platform's first logins), else the business of
 * their primary store (counter and sales staff are placed through their store assignment and carry no business of their own).
 */
export const BUSINESS_OF_USER_SQL = `coalesce(u.business_id, (select s.business_id from user_stores us join stores s on s.id = us.store_id
    where us.user_id = u.id and us.active and not us.archive order by us.is_primary desc, us.id limit 1))`;

export async function businessOfUser(manager: EntityManager, userId: number): Promise<number | null> {
  const [r] = await manager.query(`select ${BUSINESS_OF_USER_SQL} as business_id from app_user u where u.id = $1`, [userId]);
  return r?.business_id ?? null;
}

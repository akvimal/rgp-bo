import { EntityManager } from 'typeorm';

/** how long a printed price list counts as this week's copy */
export const PRICE_LIST_FRESH_DAYS = 7;

/** when the price list was last printed in a business (by anyone in it), for the Price page and the checklist's automatic item */
export async function lastPriceListPrint(manager: EntityManager, businessId: number) {
  const [r] = await manager.query(
    `select a.occurred_on, u.full_name as by_name, a.details
       from audit_event a join app_user u on u.id = a.user_id
      where a.action = 'outage.price_list_printed'
        and (select coalesce(x.business_id, (select s.business_id from user_stores us join stores s on s.id = us.store_id where us.user_id = x.id and us.active and not us.archive order by us.is_primary desc, us.id limit 1)) from app_user x where x.id = a.user_id) = $1
      order by a.id desc limit 1`, [businessId]);
  if (!r) return null;
  return { on: r.occurred_on as string, by: r.by_name as string, count: r.details?.count ?? null, fresh: Date.now() - new Date(r.occurred_on).getTime() < PRICE_LIST_FRESH_DAYS * 86400000 };
}

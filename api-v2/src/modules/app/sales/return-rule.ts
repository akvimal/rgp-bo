import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export type ReturnRule = 'FREE' | 'INSPECT' | 'NONE';
export const RETURN_RULES: ReturnRule[] = ['FREE', 'INSPECT', 'NONE'];

/** what each sale line may do on return: the product's own rule, else its category's, else free */
export async function returnRules(manager: EntityManager, saleItemIds: number[]): Promise<Map<number, { rule: ReturnRule; title: string; category: string | null }>> {
  const out = new Map<number, { rule: ReturnRule; title: string; category: string | null }>();
  if (!saleItemIds.length) return out;
  const rows = await manager.query(
    `select si.id, p.title, p.category, coalesce(p.return_rule, crr.rule, 'FREE') as rule
       from sale_item si join sale s on s.id = si.sale_id join product p on p.id = si.product_id
       left join stores st on st.id = s.store_id
       left join return_category_rule crr on crr.business_id = st.business_id and lower(crr.category) = lower(p.category)
      where si.id = any($1::int[])`, [saleItemIds]);
  for (const r of rows) out.set(r.id, { rule: r.rule, title: r.title, category: r.category });
  return out;
}

/** a refund in cash is capped by the store; over the cap (or none allowed) it goes to store credit */
export async function checkCashRefund(manager: EntityManager, storeId: number | null, amount: number) {
  if (!storeId) return;
  const [r] = await manager.query(`select cash_refund_limit::float as lim from stores where id = $1`, [storeId]);
  if (!r || r.lim === null || r.lim === undefined) return;
  if (Number(r.lim) <= 0) throw new BadRequestException('This store does not refund in cash. Refund by store credit.');
  if (amount > Number(r.lim) + 0.005) throw new BadRequestException(`This store refunds at most ${Number(r.lim).toFixed(2)} in cash on one return; this one is ${amount.toFixed(2)}. Refund by store credit.`);
}

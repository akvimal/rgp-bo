import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class QualityService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  /**
   * One row per person who billed in the window. A bill belongs to its acting user (the person who
   * served the customer), falling back to the signed-in user for history that predates acting_user_id.
   * Returns count against the person who billed the original sale. Edits come from the audit log.
   */
  async staffSales(q: { from: string; to: string; storeid?: number }) {
    const args = [q.from, q.to, q.storeid ?? null];
    const rows = await this.manager.query(
      `with bills as (
         select s.id, s.total, s.disc_amount, s.customer_id, s.bill_date,
                (c.mobile is distinct from '0000000000') as has_mobile,
                coalesce(s.acting_user_id, s.created_by) as uid
           from sale s
          left join customer c on c.id = s.customer_id
          where s.status = 'COMPLETE'
            and s.bill_date >= $1::date and s.bill_date < ($2::date + 1)
            and ($3::int is null or s.store_id = $3::int)
       ),
       lines as (
         select b.uid, sum(si.qty) as units
           from bills b join sale_item si on si.sale_id = b.id
          group by b.uid
       ),
       rets as (
         select b.uid, count(distinct b.id) as return_bills,
                coalesce(sum(sri.qty * si.total / nullif(si.qty, 0)), 0) as return_value
           from bills b
           join sale_item si on si.sale_id = b.id
           join sale_return_item sri on sri.sale_item_id = si.id and sri.active and not sri.archive
          group by b.uid
       ),
       edits as (
         select coalesce(a.acting_user_id, a.user_id) as uid, count(*) as edits
           from audit_event a
          where a.action = 'sale.edit'
            and a.occurred_on >= $1::date and a.occurred_on < ($2::date + 1)
          group by 1
       )
       select b.uid as userid, u.full_name as name, r.name as role,
              count(*)::int as bills,
              round(sum(b.total)::numeric, 2) as value,
              round(avg(b.total)::numeric, 2) as avg_bill,
              coalesce(l.units, 0)::int as units,
              round(coalesce(sum(b.disc_amount), 0)::numeric, 2) as discount,
              case when sum(b.total + coalesce(b.disc_amount, 0)) > 0
                   then round((100 * coalesce(sum(b.disc_amount), 0) / sum(b.total + coalesce(b.disc_amount, 0)))::numeric, 1)
                   else 0 end as discount_pct,
              count(distinct b.customer_id)::int as customers,
              round((100.0 * count(*) filter (where b.has_mobile) / count(*))::numeric, 1) as mobile_pct,
              count(distinct b.bill_date::date)::int as active_days,
              coalesce(rt.return_bills, 0)::int as return_bills,
              round(coalesce(rt.return_value, 0)::numeric, 2) as return_value,
              coalesce(e.edits, 0)::int as edits
         from bills b
         left join app_user u on u.id = b.uid
         left join app_role r on r.id = u.role_id
         left join lines l on l.uid = b.uid
         left join rets rt on rt.uid = b.uid
         left join edits e on e.uid = b.uid
        group by b.uid, u.full_name, r.name, l.units, rt.return_bills, rt.return_value, e.edits
        order by sum(b.total) desc`,
      args,
    );
    return rows;
  }
}

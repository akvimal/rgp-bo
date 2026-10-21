import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { GrievanceScope } from './grievance.service';

export const REFILL_OUTCOMES = ['WILL_BUY', 'NO_ANSWER', 'CALLBACK', 'BOUGHT_ELSEWHERE', 'NOT_NEEDED'];
// how long a follow-up hides the customer from the due list
const SNOOZE_DAYS: Record<string, number> = { NO_ANSWER: 2, CALLBACK: 3, WILL_BUY: 14, BOUGHT_ELSEWHERE: 30, NOT_NEEDED: 90 };

/**
 * Chronic customers who are due, or late, for a refill. A customer qualifies with at least three visits
 * that included a chronic medicine and a real mobile number; their usual gap is the median days between
 * those visits. Expected refill = last visit + usual gap.
 */
@Injectable()
export class RefillService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async list(sc: GrievanceScope, q: { bucket?: string; storeid?: number; showsnoozed?: boolean }) {
    const rows = await this.manager.query(
      `with visits as (
         select s.customer_id, s.bill_date::date as d, max(s.store_id) as store_id,
                sum(si.total) as val, string_agg(distinct p.title, ', ') as titles
           from sale s
           join sale_item si on si.sale_id = s.id
           join product p on p.id = si.product_id
           join customer c on c.id = s.customer_id
          where s.status = 'COMPLETE' and p.more_props->>'chronic' = 'true'
            and c.mobile ~ '^[0-9]{10}$' and c.mobile <> '0000000000'
            and s.bill_date >= current_date - 730
          group by s.customer_id, s.bill_date::date
       ),
       gaps as (select customer_id, d, d - lag(d) over (partition by customer_id order by d) as gap from visits),
       per as (
         select customer_id, count(*)::int as visits, max(d) as last_d,
                percentile_cont(0.5) within group (order by gap) filter (where gap >= 7) as med
           from gaps group by customer_id
       ),
       last_visit as (select distinct on (customer_id) customer_id, store_id, titles from visits order by customer_id, d desc),
       value as (select customer_id, avg(val) as avg_val from visits group by customer_id),
       fu as (select distinct on (customer_id) customer_id, outcome, note, snoozed_until, created_on, created_by
                from refill_followup order by customer_id, created_on desc)
       select c.id as customer_id, c.name, c.mobile, per.visits, per.last_d as last_bought,
              round(per.med)::int as usual_gap,
              (per.last_d + round(per.med)::int) as expected_on,
              (current_date - (per.last_d + round(per.med)::int)) as days_over,
              case when current_date - (per.last_d + round(per.med)::int) > 45 then 'LAPSED'
                   when current_date - (per.last_d + round(per.med)::int) > 0 then 'OVERDUE'
                   else 'UPCOMING' end as bucket,
              round(value.avg_val::numeric) as typical_value,
              lv.titles, lv.store_id, st.location as store,
              fu.outcome as last_outcome, fu.note as last_note, fu.created_on as last_contact, fu.snoozed_until,
              (fu.snoozed_until > current_date) as snoozed, u.full_name as last_contact_by
         from per
         join customer c on c.id = per.customer_id
         join last_visit lv on lv.customer_id = per.customer_id
         join value on value.customer_id = per.customer_id
         left join stores st on st.id = lv.store_id
         left join fu on fu.customer_id = per.customer_id
         left join app_user u on u.id = fu.created_by
        where per.visits >= 3 and per.med is not null and per.med <= 150
          and current_date - per.last_d <= 365
          and per.last_d + round(per.med)::int <= current_date + 7
          and ($1::int[] is null or lv.store_id = any($1::int[]))
          and ($2::int is null or lv.store_id = $2::int)
        order by value.avg_val desc`,
      [sc.storeIds, q.storeid ?? null],
    );
    const visible = rows.filter((r: any) => q.showsnoozed || !r.snoozed);
    const counts = { UPCOMING: 0, OVERDUE: 0, LAPSED: 0, snoozed: rows.length - visible.length };
    visible.forEach((r: any) => { counts[r.bucket as 'UPCOMING' | 'OVERDUE' | 'LAPSED']++; });
    // Default view is what can still be acted on: overdue first, then due this week; lapsed has its own tab.
    const rank: Record<string, number> = { OVERDUE: 0, UPCOMING: 1, LAPSED: 2 };
    const shown = q.bucket ? visible.filter((r: any) => r.bucket === q.bucket) : visible.filter((r: any) => r.bucket !== 'LAPSED');
    shown.sort((a: any, b: any) => rank[a.bucket] - rank[b.bucket] || (+b.typical_value || 0) - (+a.typical_value || 0));
    return { counts, rows: shown };
  }

  /** How follow-ups are working: contacts in the last 30 days and how many then bought. */
  async results(sc: GrievanceScope) {
    const [r] = await this.manager.query(
      `with f as (
         select distinct on (customer_id) customer_id, created_on
           from refill_followup where created_on >= now() - interval '30 days' and outcome <> 'NO_ANSWER'
          order by customer_id, created_on desc)
       select count(*)::int as contacted,
              count(*) filter (where exists (
                select 1 from sale s join sale_item si on si.sale_id = s.id join product p on p.id = si.product_id
                 where s.customer_id = f.customer_id and s.status = 'COMPLETE' and s.bill_date > f.created_on
                   and p.more_props->>'chronic' = 'true'))::int as bought_after
         from f`);
    return r;
  }

  async record(sc: GrievanceScope, customerId: number, outcome: string, note?: string) {
    if (!REFILL_OUTCOMES.includes(outcome)) throw new BadRequestException('Unknown outcome.');
    const [c] = await this.manager.query(`select id from customer where id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    if (sc.storeIds) {   // a store's staff log contacts for customers who buy at their store
      const [mine] = await this.manager.query(`select 1 as ok from sale where customer_id = $1 and store_id = any($2::int[]) limit 1`, [customerId, sc.storeIds]);
      if (!mine) throw new NotFoundException('Customer not found.');
    }
    const [row] = await this.manager.query(
      `insert into refill_followup (customer_id, outcome, note, snoozed_until, created_by)
       values ($1, $2, $3, current_date + $4::int, $5) returning id, snoozed_until`,
      [customerId, outcome, note?.trim() || null, SNOOZE_DAYS[outcome], sc.userId]);
    return row;
  }
}

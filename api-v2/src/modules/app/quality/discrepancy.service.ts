import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

/** Cash and shift controls: where the cash drawer did not balance, spending without proof, shifts never closed. */
@Injectable()
export class DiscrepancyService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async report(q: { from: string; to: string; storeid?: number }) {
    const args = [q.from, q.to, q.storeid ?? null];

    // Closed shifts that did not balance. variance = counted - expected, so negative is a shortage.
    const shifts = await this.manager.query(
      `select sh.id, sh.shift_date, sh.name, st.location as store, sh.store_id,
              coalesce(sh.closed_operator_id, sh.closed_by, sh.assigned_user_id) as userid, u.full_name as name_of_person,
              round(sh.expected_cash::numeric, 2) as expected, round(sh.counted_cash::numeric, 2) as counted,
              round(sh.variance::numeric, 2) as variance, sh.closed_on, sh.notes
         from store_shifts sh
         join stores st on st.id = sh.store_id
         left join app_user u on u.id = coalesce(sh.closed_operator_id, sh.closed_by, sh.assigned_user_id)
        where sh.status = 'CLOSED' and not sh.archive and sh.counted_cash is not null and coalesce(sh.variance, 0) <> 0
          and sh.shift_date >= $1::date and sh.shift_date <= $2::date and ($3::int is null or sh.store_id = $3::int)
        order by sh.shift_date desc, sh.id desc`, args);

    // How many shifts each person closed in the period, balanced or not, so a shortage can be read against volume.
    const people = await this.manager.query(
      `select coalesce(sh.closed_operator_id, sh.closed_by, sh.assigned_user_id) as userid, u.full_name as name,
              count(*)::int as shifts_closed,
              count(*) filter (where coalesce(sh.variance, 0) <> 0)::int as shifts_off,
              round(coalesce(sum(sh.variance) filter (where sh.variance < 0), 0)::numeric, 2) as short,
              round(coalesce(sum(sh.variance) filter (where sh.variance > 0), 0)::numeric, 2) as over,
              round(coalesce(sum(sh.variance), 0)::numeric, 2) as net
         from store_shifts sh
         left join app_user u on u.id = coalesce(sh.closed_operator_id, sh.closed_by, sh.assigned_user_id)
        where sh.status = 'CLOSED' and not sh.archive and sh.counted_cash is not null
          and sh.shift_date >= $1::date and sh.shift_date <= $2::date and ($3::int is null or sh.store_id = $3::int)
        group by 1, 2
        order by sum(sh.variance) asc nulls last`, args);

    // Spending recorded without a receipt.
    const noReceipt = await this.manager.query(
      `select c.id, c.trans_date, st.location as store, c.expense_category, c.description, round(c.withdraw::numeric, 2) as amount
         from store_cash_accounts c join stores st on st.id = c.store_id
        where c.category = 'EXPENSE' and c.withdraw > 0 and coalesce(trim(c.receipt_path), '') = ''
          and c.trans_date >= $1::date and c.trans_date <= $2::date and ($3::int is null or c.store_id = $3::int)
        order by c.trans_date desc, c.id desc limit 200`, args);

    // Shifts still open after their day ended: the cash drawer was never counted.
    const stale = await this.manager.query(
      `select sh.id, sh.shift_date, sh.name, st.location as store, sh.opened_on,
              u.full_name as opened_by_name, (current_date - sh.shift_date) as days_open
         from store_shifts sh join stores st on st.id = sh.store_id
         left join app_user u on u.id = coalesce(sh.opened_by, sh.assigned_user_id)
        where sh.status = 'OPEN' and not sh.archive and sh.shift_date < current_date
          and ($1::int is null or sh.store_id = $1::int)
        order by sh.shift_date`, [q.storeid ?? null]);

    const sum = (rows: any[], k: string) => rows.reduce((t, r) => t + (+r[k] || 0), 0);
    const totals = {
      shifts_off: shifts.length,
      short: Math.round(sum(shifts.filter((s: any) => +s.variance < 0), 'variance') * 100) / 100,
      over: Math.round(sum(shifts.filter((s: any) => +s.variance > 0), 'variance') * 100) / 100,
      no_receipt_count: noReceipt.length,
      no_receipt_amount: Math.round(sum(noReceipt, 'amount') * 100) / 100,
      stale_open: stale.length,
    };
    return { totals, shifts, people, noReceipt, stale };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { GrievanceScope } from './grievance.service';

import { FOLLOWUP_KEY } from '../customers/customer-followup-rules';
import { refillLang, refillMessages } from './refill-message';
import { loadTurnaround } from '../customers/customer-turnaround.service';
import { dayIndexOfText, dayTextOfIndex, summarise } from '../customers/customer-turnaround-rules';
import { bucketOf, earliestDue, MedicineDue, parseSupplyDays, runOut, SHORT_DATED_DAYS, stockState } from './refill-supply-rules';

export const REFILL_OUTCOMES = ['WILL_BUY', 'NO_ANSWER', 'CALLBACK', 'BOUGHT_ELSEWHERE', 'NOT_NEEDED', 'MESSAGED'];
// how long a follow-up hides the customer from the due list
const SNOOZE_DAYS: Record<string, number> = { NO_ANSWER: 2, CALLBACK: 3, MESSAGED: 3, WILL_BUY: 14, BOUGHT_ELSEWHERE: 30, NOT_NEEDED: 90 };

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
       -- the last contact from either screen (the one contact log), and the last snooze, which only a refill contact sets
       lastc as (select distinct on (customer_id) customer_id, outcome, note, created_on, created_by, channel, source
                   from customer_contact_log order by customer_id, created_on desc, id desc),
       sn as (select distinct on (customer_id) customer_id, snoozed_until
                from customer_contact_log where snoozed_until is not null order by customer_id, created_on desc, id desc),
       fu as (select lastc.*, sn.snoozed_until from lastc left join sn on sn.customer_id = lastc.customer_id)
       select c.id as customer_id, c.name, c.mobile, c.message_language, c.do_not_contact, per.visits, per.last_d::text as last_bought, current_date::text as today_d,
              round(per.med)::int as usual_gap,
              (per.last_d + round(per.med)::int)::text as expected_on,
              (current_date - (per.last_d + round(per.med)::int)) as days_over,
              case when current_date - (per.last_d + round(per.med)::int) > 45 then 'LAPSED'
                   when current_date - (per.last_d + round(per.med)::int) > 0 then 'OVERDUE'
                   else 'UPCOMING' end as bucket,
              round(value.avg_val::numeric) as typical_value,
              lv.titles, lv.store_id, st.location as store,
              fu.outcome as last_outcome, fu.note as last_note, fu.created_on as last_contact, fu.channel as last_channel, fu.source as last_source, fu.snoozed_until,
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
    await this.refineByMedicine(rows);
    const visible = rows.filter((r: any) => q.showsnoozed || !r.snoozed);
    const counts = { UPCOMING: 0, OVERDUE: 0, LAPSED: 0, snoozed: rows.length - visible.length };
    visible.forEach((r: any) => { counts[r.bucket as 'UPCOMING' | 'OVERDUE' | 'LAPSED']++; });
    // Default view is what can still be acted on: overdue first, then due this week; lapsed has its own tab.
    const rank: Record<string, number> = { OVERDUE: 0, UPCOMING: 1, LAPSED: 2 };
    const shown = q.bucket ? visible.filter((r: any) => r.bucket === q.bucket) : visible.filter((r: any) => r.bucket !== 'LAPSED');
    shown.sort((a: any, b: any) => rank[a.bucket] - rank[b.bucket] || (+b.typical_value || 0) - (+a.typical_value || 0));
    // the reminder for each row, from the shop's own "due back" wording, so the screen needs no access to the wording itself
    const [setting] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive`, [FOLLOWUP_KEY]);
    let saved: unknown = null;
    try { saved = setting?.setting_value ? JSON.parse(setting.setting_value) : null; } catch { saved = null; }
    const [biz] = await this.manager.query(`select name from business where active and not archive order by id limit 1`);
    const store = String(biz?.name || 'our shop').trim();
    const rowsOut = shown.map((r: any) => {
      const { message_language, do_not_contact, ...rest } = r;
      return { ...rest, language: refillLang(message_language), messages: refillMessages(saved, store, { name: r.name, doNotContact: do_not_contact, medicines: (r.medicines || []).map((m: any) => String(m.title).replace(/\s*\[[^\]]*\]\s*$/, '')) }) };
    });
    return { counts, rows: rowsOut };
  }

  /**
   * The list above works from the days between visits. This narrows it to the medicine: each chronic medicine a customer buys gets its own run-out date
   * (from their own pattern and the units bought, or the product's "days one unit lasts"), the customer is due when the earliest runs out, and the row names
   * the medicines due and whether there is stock to sell them. A customer none of whose medicines has an estimate keeps the visit-gap date. Edits `rows`
   * in place; a customer whose medicines last longer than the visit gap suggested drops out of the list.
   */
  private async refineByMedicine(rows: any[]) {
    if (!rows.length) return;
    const today = dayIndexOfText(rows[0].today_d);
    const ids = rows.map((r) => r.customer_id);
    const lines = await this.manager.query(
      `select s.customer_id, si.product_id, p.title, p.more_props->>'supplyDays' as supply_days, s.bill_date::date::text as d, sum(si.qty)::int as qty
         from sale s join sale_item si on si.sale_id = s.id join product p on p.id = si.product_id
        where s.status = 'COMPLETE' and p.more_props->>'chronic' = 'true' and s.customer_id = any($1::int[]) and s.bill_date >= current_date - 730
        group by s.customer_id, si.product_id, p.title, p.more_props->>'supplyDays', s.bill_date::date`, [ids]);
    const per = new Map<string, { customer: number; product: number; title: string; days: number | null; purchases: { day: number; qty: number }[] }>();
    for (const l of lines) {
      const key = `${l.customer_id}:${l.product_id}`;
      let e = per.get(key);
      if (!e) { e = { customer: +l.customer_id, product: +l.product_id, title: l.title, days: parseSupplyDays(l.supply_days), purchases: [] }; per.set(key, e); }
      e.purchases.push({ day: dayIndexOfText(l.d), qty: Number(l.qty) });
    }
    const meds = new Map<number, MedicineDue[]>();
    for (const e of per.values()) {
      const r = runOut(e.purchases, e.days);
      if (!r) continue;
      const m: MedicineDue = { product_id: e.product, title: e.title, last_day: r.lastDay, qty: r.lastQty, expected_day: r.expectedDay, days_per_unit: r.daysPerUnit, supply_days: r.supplyDays, basis: r.basis };
      const a = meds.get(e.customer);
      if (a) a.push(m); else meds.set(e.customer, [m]);
    }
    // stock of the medicines that are due, from the batches on hand (not past a short-dated margin)
    const dueProducts = new Set<number>();
    const picked = new Map<number, ReturnType<typeof earliestDue>>();
    for (const r of rows) {
      const d = earliestDue(meds.get(r.customer_id) || []);
      picked.set(r.customer_id, d);
      if (d && d.expectedDay <= today + 7) d.due.forEach((m) => dueProducts.add(m.product_id));
    }
    const stock = new Map<number, string>();
    if (dueProducts.size) {
      const st = await this.manager.query(
        `select product_id, coalesce(sum(available), 0)::int as total, coalesce(sum(available) filter (where product_expdate > current_date + $2::int), 0)::int as beyond
           from inventory_view where product_id = any($1::int[]) and active group by product_id`, [[...dueProducts], SHORT_DATED_DAYS]);
      for (const s of st) stock.set(+s.product_id, stockState(Number(s.total), Number(s.beyond)));
      for (const id of dueProducts) if (!stock.has(id)) stock.set(id, 'none');
    }
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      const d = picked.get(r.customer_id);
      r.basis = 'visits'; r.medicines = [];
      if (!d) continue;                                                // no estimate for any medicine: the visit-gap date stands
      if (d.expectedDay > today + 7) { rows.splice(i, 1); continue; }  // their medicines last well past the visit gap
      r.basis = d.due[0].basis;
      r.expected_on = dayTextOfIndex(d.expectedDay);
      r.days_over = today - d.expectedDay;
      r.bucket = bucketOf(r.days_over);
      r.medicines = d.due.map((m) => ({ title: m.title, expected_on: dayTextOfIndex(m.expected_day), basis: m.basis, supply_days: m.supply_days, qty: m.qty, stock: stock.get(m.product_id) || 'ok' }));
    }
  }

  /**
   * How follow-ups are working: refill contacts of the last 30 days and how many then bought a chronic medicine within the window. The same measure as the
   * turnaround report (customer-turnaround-rules.ts); `lapsed` and `waiting` say what became of the rest.
   */
  async results(sc: GrievanceScope) {
    const day = (d: Date) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
    const now = new Date();
    const windows = { refillDays: await this.refillWindow(), lapsedDays: 14 };
    const { results } = await loadTurnaround(this.manager, day(new Date(now.getTime() - 29 * 86400000)), day(now), null, windows);
    const refills = results.filter((r) => r.kind === 'refill');
    const s = summarise(refills);
    return { contacted: s.contacts, bought_after: s.cameBack, lapsed: s.lapsed, waiting: s.waiting, median_days: s.medianDays, window_days: windows.refillDays };
  }

  private async refillWindow(): Promise<number> {
    const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = 'turnaround_refill_days' and active and not archive limit 1`);
    const n = Math.round(Number(r?.setting_value));
    return Number.isFinite(n) && n >= 1 && n <= 60 ? n : 7;
  }

  /** a contact from the Refills page goes into the one contact log (a sent reminder is a WhatsApp message sent, the rest are calls) */
  async record(sc: GrievanceScope, customerId: number, outcome: string, note?: string, dueOn?: string) {
    if (!REFILL_OUTCOMES.includes(outcome)) throw new BadRequestException('Unknown outcome.');
    const [c] = await this.manager.query(`select id from customer where id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    if (sc.storeIds) {   // a store's staff log contacts for customers who buy at their store
      const [mine] = await this.manager.query(`select 1 as ok from sale where customer_id = $1 and store_id = any($2::int[]) limit 1`, [customerId, sc.storeIds]);
      if (!mine) throw new NotFoundException('Customer not found.');
    }
    const sent = outcome === 'MESSAGED';
    const [row] = await this.manager.query(
      `insert into customer_contact_log (customer_id, channel, audience, outcome, note, created_by, source, due_on, snoozed_until)
       values ($1, $2, 'due_back', $3, $4, $5, 'refill', $6::date, current_date + $7::int) returning id, snoozed_until`,
      [customerId, sent ? 'WHATSAPP' : 'CALL', sent ? 'SENT' : outcome, note?.trim() || null, sc.userId, dueOn || null, SNOOZE_DAYS[outcome]]);
    return row;
  }
}

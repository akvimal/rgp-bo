import { Injectable, Logger } from '@nestjs/common';
import { DIGITAL_PROVIDER, SHIFT_DIGITAL_SQL } from "../sales/digital-payment";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { sendTime } from './messaging-rules';
import { MessagingService } from './messaging.service';
import { DayFacts, formatDayGroup, formatDayManager, sumDigital } from './day-summary-rules';
import { OpenFacts, ShiftFacts, TOLERANCE, formatOpenGroup, formatOpenManager, formatShiftGroup, formatShiftManager } from './shift-digest-rules';
import { TelegramAdapter } from './telegram.adapter';

const CHANNEL = 'TELEGRAM';
const KIND = 'SHIFT_CLOSE';
const OPEN_KIND = 'SHIFT_OPEN';
const DAY_KIND = 'DAY_SUMMARY';

/**
 * Tells the shop a shift has opened or closed. The store's group (the chat id kept for its daily digest) gets the plain version (bills and takings, no cash amounts
 * and no names) unless the owner chose the full version for it; each person who runs the shop and has connected Telegram gets a personal message with the full
 * sales summary: bills by staff, cash against UPI/card, deliveries, expenses, the drawer, the terminals and what was paid out. It never
 * holds up or fails the close: anything that goes wrong is logged and the close stands. One message per shift and recipient, so a repeat does nothing.
 * When the shift closed is the day's last (the end-of-day close), a day summary follows: the whole day's shifts in one message, in the same two versions.
 */
@Injectable()
export class ShiftDigestService {
  private readonly log = new Logger(ShiftDigestService.name);

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly telegram: TelegramAdapter, private readonly messaging: MessagingService) {}

  /** called after a shift closes; does not wait and never throws */
  notifyClosed(shiftId: number): void {
    void this.run(shiftId)
      .catch((e) => this.log.warn(`Shift close message for shift ${shiftId} failed: ${e?.message}`))
      .then(() => this.runDay(shiftId))
      .catch((e) => this.log.warn(`Day summary for shift ${shiftId} failed: ${e?.message}`));
  }

  /** called after a shift opens; does not wait and never throws */
  notifyOpened(shiftId: number): void {
    void this.runOpen(shiftId).catch((e) => this.log.warn(`Shift open message for shift ${shiftId} failed: ${e?.message}`));
  }

  /** public so a test can run it and wait */
  async run(shiftId: number): Promise<{ group: boolean; direct: number }> {
    if (!this.telegram.configured) return { group: false, direct: 0 };
    const facts = await this.facts(shiftId);
    if (!facts) return { group: false, direct: 0 };
    const { businessId, storeId } = facts.ids;
    const sw = await this.switches(businessId);
    if (!sw.on || !sw.close) return { group: false, direct: 0 };
    const group = await this.toGroup(KIND, shiftId, storeId, formatShiftGroup(facts.facts, sw.groupFull));
    const direct = await this.toManagers(shiftId, businessId, storeId, facts.facts);
    return { group, direct };
  }

  /** the day summary, when this shift closed the day; public so a test can run it and wait */
  async runDay(shiftId: number): Promise<{ group: boolean; direct: number }> {
    if (!this.telegram.configured) return { group: false, direct: 0 };
    const d = await this.dayFacts(shiftId);
    if (!d) return { group: false, direct: 0 };
    const sw = await this.switches(d.ids.businessId);
    if (!sw.on || !sw.day) return { group: false, direct: 0 };
    const group = await this.toGroup(DAY_KIND, shiftId, d.ids.storeId, formatDayGroup(d.facts, sw.groupFull));
    const [title, ...rest] = formatDayManager(d.facts).split('\n');
    const direct = await this.queueToManagers({ businessId: d.ids.businessId, storeId: d.ids.storeId, kind: DAY_KIND, refType: 'shift', refId: shiftId, title: title.replace(/^\S+\s/, ''), body: rest.join('\n').trim(), immediate: true });
    return { group, direct };
  }

  async runOpen(shiftId: number): Promise<{ group: boolean; direct: number }> {
    if (!this.telegram.configured) return { group: false, direct: 0 };
    const o = await this.openFacts(shiftId);
    if (!o) return { group: false, direct: 0 };
    const sw = await this.switches(o.ids.businessId);
    if (!sw.on || !sw.open) return { group: false, direct: 0 };
    const group = await this.toGroup(OPEN_KIND, shiftId, o.ids.storeId, formatOpenGroup(o.facts, sw.groupFull));
    const [title, ...rest] = formatOpenManager(o.facts).split('\n');
    const direct = await this.queueToManagers({ businessId: o.ids.businessId, storeId: o.ids.storeId, kind: OPEN_KIND, refType: 'shift', refId: shiftId, title: title.replace(/^\S+\s/, ''), body: rest.join('\n').trim() });
    return { group, direct };
  }

  /**
   * The owner's switches, all kept in app_setting: Telegram alerts as a whole (alerts_telegram), the shift-close message (shift_close_message) and the shift-open
   * message (shift_open_message) and the day summary at the end-of-day close (day_summary_message) are on unless set to off; the full version for the store group
   * (shift_group_full) is off unless set to on.
   */
  async switches(businessId: number | null): Promise<{ on: boolean; close: boolean; open: boolean; day: boolean; groupFull: boolean }> {
    if (!businessId) return { on: false, close: false, open: false, day: false, groupFull: false };
    const rows = await this.manager.query(`select setting_key, setting_value from app_setting where setting_key in ('alerts_telegram', 'shift_close_message', 'shift_open_message', 'day_summary_message', 'shift_group_full') and active and not archive`);
    const get = (k: string, dflt: string) => String(rows.find((r: any) => r.setting_key === k)?.setting_value ?? dflt).toLowerCase();
    return { on: get('alerts_telegram', 'on') !== 'off', close: get('shift_close_message', 'on') !== 'off', open: get('shift_open_message', 'on') !== 'off', day: get('day_summary_message', 'on') !== 'off', groupFull: get('shift_group_full', 'off') === 'on' };
  }

  private async facts(shiftId: number): Promise<{ facts: ShiftFacts; ids: { businessId: number | null; storeId: number } } | null> {
    const [s] = await this.manager.query(
      `select sh.id, sh.store_id, sh.name, sh.start_time, sh.end_time, sh.status, sh.close_type, sh.opened_on, sh.closed_on, sh.expected_cash::float as expected, sh.counted_cash::float as counted,
              sh.closing_digital, st.location, st.business_id, coalesce(nullif(btrim(cu.full_name), ''), null) as closed_by
         from store_shifts sh join stores st on st.id = sh.store_id left join app_user cu on cu.id = coalesce(sh.closed_operator_id, sh.closed_by)
        where sh.id = $1`, [shiftId]);
    if (!s || s.status !== 'CLOSED') return null;
    const [t] = await this.manager.query(
      `select count(*)::int as bills, coalesce(sum(total), 0)::float as sales, coalesce(sum(cash_amount), 0)::float as cash, coalesce(sum(digi_amount), 0)::float as digital,
              coalesce(sum(credit_amount), 0)::float as credit, count(*) filter (where customer_id is null)::int as no_customer
         from sale where shift_id = $1 and status = 'COMPLETE' and active = true`, [shiftId]);
    const [i] = await this.manager.query(
      `select coalesce(sum(si.qty), 0)::int as items from sale_item si join sale sa on sa.id = si.sale_id where sa.shift_id = $1 and sa.status = 'COMPLETE' and sa.active = true and si.active = true`, [shiftId]);
    // a customer is new when this shift holds their first completed bill
    const [c] = await this.manager.query(
      `with first_here as (select customer_id, min(bill_date) as d from sale where shift_id = $1 and status = 'COMPLETE' and active = true and customer_id is not null group by 1)
       select count(*) filter (where not exists (select 1 from sale p where p.customer_id = f.customer_id and p.status = 'COMPLETE' and p.active = true and p.bill_date < f.d and p.shift_id is distinct from $1))::int as new_c,
              count(*)::int as known from first_here f`, [shiftId]);
    const [r] = await this.manager.query(
      `select count(*)::int as n from sale_return_item ri join sale_item si on si.id = ri.sale_item_id join sale sa on sa.id = si.sale_id
        where sa.store_id = $1 and ri.active = true and ri.created_on >= $2 and ri.created_on <= coalesce($3, now())`, [s.store_id, s.opened_on ?? s.closed_on, s.closed_on]);
    const [e] = await this.manager.query(
      `select coalesce(sum(withdraw) filter (where category = 'EXPENSE'), 0)::float as exp_total, count(*) filter (where category = 'EXPENSE')::int as exp_count,
              coalesce(sum(withdraw) filter (where category = 'REFUND'), 0)::float as refunds, coalesce(sum(withdraw) filter (where category = 'BANK_DEPOSIT'), 0)::float as deposits
         from store_cash_accounts where shift_id = $1`, [shiftId]);
    // a shop that keeps no drug register has no such table, or no entries: say nothing then
    let scheduled: number | null = null;
    try {
      const [x] = await this.manager.query(`select count(*)::int as n from schedule_register where sale_id in (select id from sale where shift_id = $1) and superseded_on is null`, [shiftId]);
      scheduled = x?.n || null;
    } catch { scheduled = null; }
    // who served the bills (the person at the counter, else the login), UPI/card by app, deliveries and the expenses by name
    const byStaff = await this.manager.query(
      `select coalesce(nullif(btrim(u.full_name), ''), 'Unknown') as name, count(*)::int as bills, coalesce(sum(sa.total), 0)::float as sales
         from sale sa left join app_user u on u.id = coalesce(sa.acting_user_id, sa.created_by)
        where sa.shift_id = $1 and sa.status = 'COMPLETE' and sa.active = true group by 1 order by sales desc, name`, [shiftId]);
    const digitalByProvider = await this.manager.query(
      `select provider, sum(bills)::int as bills, coalesce(sum(amount), 0)::float as amount from (${SHIFT_DIGITAL_SQL}) x where amount > 0 group by 1 order by amount desc`, [shiftId, DIGITAL_PROVIDER]);
    const [dv] = await this.manager.query(
      `select count(*)::int as total, count(*) filter (where d.status = 'Delivered')::int as delivered, count(*) filter (where d.status = 'Failed')::int as failed,
              count(*) filter (where coalesce(d.status, 'Pending') = 'Pending')::int as pending
         from sale sa left join sale_deliveries d on d."saleId" = sa.id
        where sa.shift_id = $1 and sa.status = 'COMPLETE' and sa.active = true and sa.delivery_type = 'Delivery'`, [shiftId]);
    const expenseLines = await this.manager.query(
      `select coalesce(nullif(btrim(expense_category), ''), nullif(btrim(description), ''), 'Expense') as label, sum(withdraw)::float as amount
         from store_cash_accounts where shift_id = $1 and category = 'EXPENSE' group by 1 order by amount desc`, [shiftId]);
    const digital = (Array.isArray(s.closing_digital) ? s.closing_digital : []).map((d: any) => ({ provider: String(d.provider), system: Number(d.system) || 0, counted: Number(d.counted) || 0, variance: Number(d.variance) || 0 }));
    return {
      ids: { businessId: s.business_id ?? null, storeId: s.store_id },
      facts: {
        store: s.location, shiftName: s.name, start: s.start_time ?? null, end: s.end_time ?? null, handover: s.close_type === 'HANDOVER', closedBy: s.closed_by ?? null,
        bills: t.bills, items: i.items, sales: t.sales, cashSales: t.cash, digitalSales: t.digital, creditSales: t.credit, returns: r.n,
        customersNew: c.new_c, customersReturning: c.known - c.new_c, billsWithoutCustomer: t.no_customer, scheduledEntries: scheduled,
        expectedCash: s.expected ?? 0, countedCash: s.counted ?? null, digital, expensesCount: e.exp_count, expensesTotal: e.exp_total, refunds: e.refunds, deposits: e.deposits,
        byStaff, digitalByProvider, deliveries: { total: dv?.total ?? 0, delivered: dv?.delivered ?? 0, pending: dv?.pending ?? 0, failed: dv?.failed ?? 0 }, expenseLines,
      },
    };
  }

  /**
   * The facts of the whole day for the shift that closed it: every closed shift of the store on that shift date, added up. Null when this shift was a handover, is not closed,
   * or when another shift of the same day is still open (the day is not over yet).
   */
  private async dayFacts(shiftId: number): Promise<{ facts: DayFacts; ids: { businessId: number | null; storeId: number } } | null> {
    const [s] = await this.manager.query(
      `select sh.id, sh.store_id, sh.status, sh.close_type, sh.shift_date, to_char(sh.shift_date, 'Dy DD Mon YYYY') as date_label, to_char(sh.shift_date, 'FMDay') as weekday,
              st.location, st.business_id
         from store_shifts sh join stores st on st.id = sh.store_id where sh.id = $1`, [shiftId]);
    if (!s || s.status !== 'CLOSED' || s.close_type === 'HANDOVER' || !s.shift_date) return null;
    const shifts = await this.manager.query(
      `select sh.id, sh.name, sh.status, sh.start_time, sh.end_time, sh.close_type, sh.opened_on, sh.closed_on, sh.expected_cash::float as expected, sh.counted_cash::float as counted, sh.closing_digital,
              nullif(btrim(cu.full_name), '') as closed_by
         from store_shifts sh left join app_user cu on cu.id = coalesce(sh.closed_operator_id, sh.closed_by)
        where sh.store_id = $1 and sh.shift_date = $2 and not sh.archive order by sh.opened_on, sh.id`, [s.store_id, s.shift_date]);
    if (shifts.some((x: any) => x.status === 'OPEN')) return null;
    const closed = shifts.filter((x: any) => x.status === 'CLOSED');
    const ids: number[] = closed.map((x: any) => +x.id);
    if (!ids.length) return null;
    const [t] = await this.manager.query(
      `select count(*)::int as bills, coalesce(sum(total), 0)::float as sales, coalesce(sum(cash_amount), 0)::float as cash, coalesce(sum(digi_amount), 0)::float as digital,
              coalesce(sum(credit_amount), 0)::float as credit, count(*) filter (where customer_id is null)::int as no_customer
         from sale where shift_id = any($1::int[]) and status = 'COMPLETE' and active = true`, [ids]);
    const [i] = await this.manager.query(
      `select coalesce(sum(si.qty), 0)::int as items from sale_item si join sale sa on sa.id = si.sale_id where sa.shift_id = any($1::int[]) and sa.status = 'COMPLETE' and sa.active = true and si.active = true`, [ids]);
    const [c] = await this.manager.query(
      `with first_here as (select customer_id, min(bill_date) as d from sale where shift_id = any($1::int[]) and status = 'COMPLETE' and active = true and customer_id is not null group by 1)
       select count(*) filter (where not exists (select 1 from sale p where p.customer_id = f.customer_id and p.status = 'COMPLETE' and p.active = true and p.bill_date < f.d and (p.shift_id is null or p.shift_id <> all($1::int[]))))::int as new_c,
              count(*)::int as known from first_here f`, [ids]);
    const first = closed[0].opened_on ?? closed[0].closed_on, last = closed[closed.length - 1].closed_on;
    const [r] = await this.manager.query(
      `select count(*)::int as n from sale_return_item ri join sale_item si on si.id = ri.sale_item_id join sale sa on sa.id = si.sale_id
        where sa.store_id = $1 and ri.active = true and ri.created_on >= $2 and ri.created_on <= coalesce($3, now())`, [s.store_id, first, last]);
    const [e] = await this.manager.query(
      `select coalesce(sum(withdraw) filter (where category = 'EXPENSE'), 0)::float as exp_total, count(*) filter (where category = 'EXPENSE')::int as exp_count,
              coalesce(sum(withdraw) filter (where category = 'REFUND'), 0)::float as refunds, coalesce(sum(withdraw) filter (where category = 'BANK_DEPOSIT'), 0)::float as deposits
         from store_cash_accounts where shift_id = any($1::int[])`, [ids]);
    let scheduled: number | null = null;
    try {
      const [x] = await this.manager.query(`select count(*)::int as n from schedule_register where sale_id in (select id from sale where shift_id = any($1::int[])) and superseded_on is null`, [ids]);
      scheduled = x?.n || null;
    } catch { scheduled = null; }
    const byStaff = await this.manager.query(
      `select coalesce(nullif(btrim(u.full_name), ''), 'Unknown') as name, count(*)::int as bills, coalesce(sum(sa.total), 0)::float as sales
         from sale sa left join app_user u on u.id = coalesce(sa.acting_user_id, sa.created_by)
        where sa.shift_id = any($1::int[]) and sa.status = 'COMPLETE' and sa.active = true group by 1 order by sales desc, name`, [ids]);
    const prov: Record<string, { provider: string; bills: number; amount: number }> = {};
    for (const id of ids) {
      const rows = await this.manager.query(`select provider, sum(bills)::int as bills, coalesce(sum(amount), 0)::float as amount from (${SHIFT_DIGITAL_SQL}) x where amount > 0 group by 1`, [id, DIGITAL_PROVIDER]);
      for (const x of rows) { const p = prov[x.provider] || (prov[x.provider] = { provider: x.provider, bills: 0, amount: 0 }); p.bills += x.bills; p.amount += x.amount; }
    }
    const digitalByProvider = Object.values(prov).sort((a, b) => b.amount - a.amount);
    const [dv] = await this.manager.query(
      `select count(*)::int as total, count(*) filter (where d.status = 'Delivered')::int as delivered, count(*) filter (where d.status = 'Failed')::int as failed,
              count(*) filter (where coalesce(d.status, 'Pending') = 'Pending')::int as pending
         from sale sa left join sale_deliveries d on d."saleId" = sa.id
        where sa.shift_id = any($1::int[]) and sa.status = 'COMPLETE' and sa.active = true and sa.delivery_type = 'Delivery'`, [ids]);
    const expenseLines = await this.manager.query(
      `select coalesce(nullif(btrim(expense_category), ''), nullif(btrim(description), ''), 'Expense') as label, sum(withdraw)::float as amount
         from store_cash_accounts where shift_id = any($1::int[]) and category = 'EXPENSE' group by 1 order by amount desc`, [ids]);
    const [lw] = await this.manager.query(
      `select count(*)::int as bills, coalesce(sum(sa.total), 0)::float as sales
         from sale sa join store_shifts x on x.id = sa.shift_id where x.store_id = $1 and x.shift_date = ($2::date - 7) and sa.status = 'COMPLETE' and sa.active = true`, [s.store_id, s.shift_date]);

    const perShiftDigital = closed.map((x: any) => (Array.isArray(x.closing_digital) ? x.closing_digital : []).map((d: any) => ({ provider: String(d.provider), system: Number(d.system) || 0, counted: Number(d.counted) || 0, variance: Number(d.variance) || 0 })));
    const billsOf = async (id: number) => (await this.manager.query(`select count(*)::int as bills, coalesce(sum(total), 0)::float as sales from sale where shift_id = $1 and status = 'COMPLETE' and active = true`, [id]))[0];
    const dayShifts: DayFacts['shifts'] = [];
    for (let k = 0; k < closed.length; k++) {
      const x = closed[k];
      const b = await billsOf(+x.id);
      const dig = perShiftDigital[k] as { variance: number }[];
      dayShifts.push({
        name: x.name, start: x.start_time ?? null, end: x.end_time ?? null, closedBy: x.closed_by ?? null, handover: x.close_type === 'HANDOVER', bills: b.bills, sales: b.sales,
        cashVariance: x.counted === null || x.counted === undefined ? null : Math.round((x.counted - (x.expected ?? 0)) * 100) / 100,
        digitalOff: dig.some((d) => Math.abs(d.variance) > TOLERANCE),
      });
    }
    const expected = closed.reduce((n: number, x: any) => n + (x.expected ?? 0), 0);
    const counted = closed.every((x: any) => x.counted !== null && x.counted !== undefined) ? closed.reduce((n: number, x: any) => n + x.counted, 0) : null;
    const total: ShiftFacts = {
      store: s.location, shiftName: 'The day', start: null, end: null, handover: false, closedBy: null,
      bills: t.bills, items: i.items, sales: t.sales, cashSales: t.cash, digitalSales: t.digital, creditSales: t.credit, returns: r.n,
      customersNew: c.new_c, customersReturning: c.known - c.new_c, billsWithoutCustomer: t.no_customer, scheduledEntries: scheduled,
      expectedCash: Math.round(expected * 100) / 100, countedCash: counted === null ? null : Math.round(counted * 100) / 100, digital: sumDigital(perShiftDigital),
      expensesCount: e.exp_count, expensesTotal: e.exp_total, refunds: e.refunds, deposits: e.deposits,
      byStaff, digitalByProvider, deliveries: { total: dv?.total ?? 0, delivered: dv?.delivered ?? 0, pending: dv?.pending ?? 0, failed: dv?.failed ?? 0 }, expenseLines,
    };
    return {
      ids: { businessId: s.business_id ?? null, storeId: s.store_id },
      facts: { total, dateLabel: s.date_label, shifts: dayShifts, lastWeek: lw && lw.sales > 0 ? { label: String(s.weekday).trim(), sales: lw.sales, bills: lw.bills } : null },
    };
  }

  private async openFacts(shiftId: number): Promise<{ facts: OpenFacts; ids: { businessId: number | null; storeId: number } } | null> {
    const [s] = await this.manager.query(
      `select sh.id, sh.store_id, sh.name, sh.start_time, sh.end_time, sh.status, sh.opening_cash::float as cash, st.location, st.business_id,
              to_char(sh.opened_on at time zone 'Asia/Kolkata', 'HH24:MI') as opened_at,
              nullif(btrim(ou.full_name), '') as opened_by, nullif(btrim(au.full_name), '') as assigned, nullif(btrim(pr.name), '') as from_name,
              exists (select 1 from store_vault_movements m where m.shift_id = sh.id and m.move_type = 'FLOAT_TO_DRAWER') as from_vault
         from store_shifts sh join stores st on st.id = sh.store_id
         left join app_user ou on ou.id = sh.opened_by left join app_user au on au.id = sh.assigned_user_id left join store_shifts pr on pr.id = sh.handover_from_shift_id
        where sh.id = $1`, [shiftId]);
    if (!s || s.status !== 'OPEN') return null;
    return {
      ids: { businessId: s.business_id ?? null, storeId: s.store_id },
      facts: { store: s.location, shiftName: s.name, start: s.start_time ?? null, end: s.end_time ?? null, openedAt: s.opened_at ?? '', openedBy: s.opened_by ?? null, drawerOf: s.assigned ?? null,
               openingCash: s.cash ?? 0, fromVault: !!s.from_vault, handoverFrom: s.from_name ?? null },
    };
  }

  /** the store's group, once per shift (the digest log keeps the guard, and a failed send can be tried again) */
  private async toGroup(kind: string, shiftId: number, storeId: number, text: string): Promise<boolean> {
    const [st] = await this.manager.query(`select telegram_chat_id, telegram_digest_enabled from stores where id = $1`, [storeId]);
    const chat = String(st?.telegram_chat_id ?? '').trim();
    if (!chat || st?.telegram_digest_enabled === false) return false;
    const scope = `store:${storeId}`;
    const claimed = await this.manager.query(
      `insert into notification_log (kind, period_key, scope, status) values ($1, $2, $3, 'PENDING') on conflict (kind, period_key, scope) do nothing returning id`, [kind, String(shiftId), scope]);
    if (!claimed.length) return false;
    try {
      await this.telegram.send(chat, text);
      await this.manager.query(`update notification_log set status = 'SENT', sent_on = now() where kind = $1 and period_key = $2 and scope = $3`, [kind, String(shiftId), scope]);
      return true;
    } catch (e: any) {
      // let a later try (the close pressed again, or a re-run) send it
      await this.manager.query(`delete from notification_log where kind = $1 and period_key = $2 and scope = $3`, [kind, String(shiftId), scope]);
      this.log.warn(`Shift ${shiftId} group message (${kind}) not sent: ${e?.message}`);
      return false;
    }
  }

  private toManagers(shiftId: number, businessId: number | null, storeId: number, facts: ShiftFacts): Promise<number> {
    const [title, ...rest] = formatShiftManager(facts).split('\n');
    return this.queueToManagers({ businessId, storeId, kind: KIND, refType: 'shift', refId: shiftId, title: title.replace(/^\S+\s/, ''), body: rest.join('\n').trim() });
  }

  /**
   * Queues one personal message for each connected owner, Business Head or Store Head of the store (held to the morning in their quiet hours, unless `immediate`: the day
 * summary at the end of the day goes when the day's last shift closes, even at night). One per person
   * for a kind and reference, so a repeat does nothing, unless `replace` is set (a manual resend).
   */
  async queueToManagers(o: { businessId: number | null; storeId: number; kind: string; refType: string; refId: number; title: string; body: string; replace?: boolean; immediate?: boolean }): Promise<number> {
    const { businessId, storeId } = o;
    if (!businessId || !this.telegram.configured) return 0;
    const people = await this.manager.query(
      `select uc.user_id, uc.chat_id, uc.quiet_from, uc.quiet_to, r.name as role
         from user_channel uc join app_user u on u.id = uc.user_id join app_role r on r.id = u.role_id
        where uc.channel = $1 and uc.status = 'ACTIVE' and u.active and not u.archive and (${BUSINESS_OF_USER_SQL}) = $2`, [CHANNEL, businessId]);
    if (o.replace) await this.manager.query(`delete from message_outbox where channel = $1 and kind = $2 and ref_type = $3 and ref_id = $4`, [CHANNEL, o.kind, o.refType, o.refId]);
    let queued = 0;
    for (const p of people) {
      if (!isManagerRole(p.role)) continue;
      if (!isOwnerRole(p.role)) {
        const [mine] = await this.manager.query(`select 1 from user_stores where user_id = $1 and store_id = $2 and active and not archive`, [p.user_id, storeId]);
        if (!mine) continue;
      }
      const now = new Date();
      const sendAt = sendTime(now, p.quiet_from, p.quiet_to, o.immediate);
      const rows = await this.manager.query(
        `insert into message_outbox (business_id, channel, recipient_user_id, chat_id, kind, ref_type, ref_id, severity, title, body, link, status, send_after)
         values ($1, $2, $3, $4, $5, $6, $7, 'info', $8, $9, null, 'PENDING', $10)
         on conflict (channel, recipient_user_id, kind, ref_type, ref_id) where ref_id is not null do nothing returning id`,
        [businessId, CHANNEL, p.user_id, p.chat_id, o.kind, o.refType, o.refId, o.title.slice(0, 200), o.body, sendAt]);
      if (rows.length) queued++;
    }
    if (queued) void this.messaging.processOutbox().catch(() => undefined);
    return queued;
  }
}

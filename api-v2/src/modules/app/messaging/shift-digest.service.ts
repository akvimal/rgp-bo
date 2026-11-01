import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { inQuiet, istMinute, quietEnds } from './messaging-rules';
import { MessagingService } from './messaging.service';
import { ShiftFacts, formatShiftGroup, formatShiftManager } from './shift-digest-rules';
import { TelegramAdapter } from './telegram.adapter';

const CHANNEL = 'TELEGRAM';
const KIND = 'SHIFT_CLOSE';

/**
 * Tells the shop a shift has closed. The store's group (the chat id kept for its daily digest) gets the shift's bills and takings, with no cash amounts and no
 * names; each person who runs the shop and has connected Telegram gets a personal message with the drawer, the terminals and what was paid out. It never
 * holds up or fails the close: anything that goes wrong is logged and the close stands. One message per shift and recipient, so a repeat does nothing.
 */
@Injectable()
export class ShiftDigestService {
  private readonly log = new Logger(ShiftDigestService.name);

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly telegram: TelegramAdapter, private readonly messaging: MessagingService) {}

  /** called after a shift closes; does not wait and never throws */
  notifyClosed(shiftId: number): void {
    void this.run(shiftId).catch((e) => this.log.warn(`Shift close message for shift ${shiftId} failed: ${e?.message}`));
  }

  /** public so a test can run it and wait */
  async run(shiftId: number): Promise<{ group: boolean; direct: number }> {
    if (!this.telegram.configured) return { group: false, direct: 0 };
    const facts = await this.facts(shiftId);
    if (!facts) return { group: false, direct: 0 };
    const { businessId, storeId } = facts.ids;
    if (!(await this.on(businessId))) return { group: false, direct: 0 };
    const group = await this.toGroup(shiftId, storeId, facts.facts);
    const direct = await this.toManagers(shiftId, businessId, storeId, facts.facts);
    return { group, direct };
  }

  /** on unless the owner switched the shop's Telegram alerts off (the same switch as the alerts) or this message off on its own */
  private async on(businessId: number | null): Promise<boolean> {
    if (!businessId) return false;
    const rows = await this.manager.query(`select setting_key, setting_value from app_setting where setting_key in ('alerts_telegram', 'shift_close_message') and active and not archive`);
    const get = (k: string) => String(rows.find((r: any) => r.setting_key === k)?.setting_value ?? 'on').toLowerCase();
    return get('alerts_telegram') !== 'off' && get('shift_close_message') !== 'off';
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
    const digital = (Array.isArray(s.closing_digital) ? s.closing_digital : []).map((d: any) => ({ provider: String(d.provider), system: Number(d.system) || 0, counted: Number(d.counted) || 0, variance: Number(d.variance) || 0 }));
    return {
      ids: { businessId: s.business_id ?? null, storeId: s.store_id },
      facts: {
        store: s.location, shiftName: s.name, start: s.start_time ?? null, end: s.end_time ?? null, handover: s.close_type === 'HANDOVER', closedBy: s.closed_by ?? null,
        bills: t.bills, items: i.items, sales: t.sales, cashSales: t.cash, digitalSales: t.digital, creditSales: t.credit, returns: r.n,
        customersNew: c.new_c, customersReturning: c.known - c.new_c, billsWithoutCustomer: t.no_customer, scheduledEntries: scheduled,
        expectedCash: s.expected ?? 0, countedCash: s.counted ?? null, digital, expensesCount: e.exp_count, expensesTotal: e.exp_total, refunds: e.refunds, deposits: e.deposits,
      },
    };
  }

  /** the store's group, once per shift (the digest log keeps the guard, and a failed send can be tried again) */
  private async toGroup(shiftId: number, storeId: number, facts: ShiftFacts): Promise<boolean> {
    const [st] = await this.manager.query(`select telegram_chat_id, telegram_digest_enabled from stores where id = $1`, [storeId]);
    const chat = String(st?.telegram_chat_id ?? '').trim();
    if (!chat || st?.telegram_digest_enabled === false) return false;
    const scope = `store:${storeId}`;
    const claimed = await this.manager.query(
      `insert into notification_log (kind, period_key, scope, status) values ($1, $2, $3, 'PENDING') on conflict (kind, period_key, scope) do nothing returning id`, [KIND, String(shiftId), scope]);
    if (!claimed.length) return false;
    try {
      await this.telegram.send(chat, formatShiftGroup(facts));
      await this.manager.query(`update notification_log set status = 'SENT', sent_on = now() where kind = $1 and period_key = $2 and scope = $3`, [KIND, String(shiftId), scope]);
      return true;
    } catch (e: any) {
      // let a later try (the close pressed again, or a re-run) send it
      await this.manager.query(`delete from notification_log where kind = $1 and period_key = $2 and scope = $3`, [KIND, String(shiftId), scope]);
      this.log.warn(`Shift ${shiftId} group message not sent: ${e?.message}`);
      return false;
    }
  }

  private toManagers(shiftId: number, businessId: number | null, storeId: number, facts: ShiftFacts): Promise<number> {
    const [title, ...rest] = formatShiftManager(facts).split('\n');
    return this.queueToManagers({ businessId, storeId, kind: KIND, refType: 'shift', refId: shiftId, title: title.replace(/^\S+\s/, ''), body: rest.join('\n').trim() });
  }

  /**
   * Queues one personal message for each connected owner, Business Head or Store Head of the store (held to the morning in their quiet hours). One per person
   * for a kind and reference, so a repeat does nothing, unless `replace` is set (a manual resend).
   */
  async queueToManagers(o: { businessId: number | null; storeId: number; kind: string; refType: string; refId: number; title: string; body: string; replace?: boolean }): Promise<number> {
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
      const quiet = inQuiet(istMinute(now), p.quiet_from, p.quiet_to);
      const rows = await this.manager.query(
        `insert into message_outbox (business_id, channel, recipient_user_id, chat_id, kind, ref_type, ref_id, severity, title, body, link, status, send_after)
         values ($1, $2, $3, $4, $5, $6, $7, 'info', $8, $9, null, 'PENDING', $10)
         on conflict (channel, recipient_user_id, kind, ref_type, ref_id) where ref_id is not null do nothing returning id`,
        [businessId, CHANNEL, p.user_id, p.chat_id, o.kind, o.refType, o.refId, o.title.slice(0, 200), o.body, quiet ? quietEnds(now, p.quiet_to) : now]);
      if (rows.length) queued++;
    }
    if (queued) void this.messaging.processOutbox().catch(() => undefined);
    return queued;
  }
}

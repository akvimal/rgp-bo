import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { isOwnerRole } from 'src/core/roles';
import {
  BELOW_LIST_PCT, BIG_DISCOUNT_PCT, LATE_RETURN_DAYS, LATE_VOID_HOURS, LIST_LIMIT, Summary,
  addDays, billDiscountPct, groupReturns, isMonday, isOver, isValidDay, lastFullWeek, marked, pctOff, readEdit, summarise, weekRange,
} from './review-rules';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

/**
 * The weekly exceptions review. For one week (Monday to Sunday) and the stores the reader may see: the bills with a discount, the lines billed below
 * the list price, the bills cancelled and the returns, set beside the week before, and the sign-off that the people who run the store looked at them.
 */
@Injectable()
export class ReviewService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  /** the stores this reader may review: every store of the business for an owner, their own stores for a Store Head */
  private async scope(user: any) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user.roleid || 0]);
    const owner = isOwnerRole(role?.name);
    const stores = owner
      ? await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive order by id`, [businessId])
      : await this.manager.query(
        `select s.id, s.location from stores s join user_stores us on us.store_id = s.id and us.user_id = $2 and us.active and not us.archive
          where s.business_id = $1 and s.active and not s.archive order by s.id`, [businessId, user.id]);
    return { businessId, owner, stores: stores.map((s: any) => ({ id: +s.id, location: String(s.location).trim() })) };
  }

  private pick(stores: { id: number }[], storeid?: number | null): number[] {
    if (storeid) {
      if (!stores.some((s) => s.id === +storeid)) throw new BadRequestException('That store is not one you can review.');
      return [+storeid];
    }
    return stores.map((s) => s.id);
  }

  /** the four lists and the totals of one week */
  private async collect(ids: number[], start: string) {
    const { next } = weekRange(start);
    const a = [ids, start, next];
    const who = `coalesce(act.full_name, cu.full_name)`;
    const joinWho = `left join app_user cu on cu.id = s.created_by left join app_user act on act.id = s.acting_user_id`;
    const [totals] = await this.manager.query(
      `select count(*)::int as bills, coalesce(sum(s.total), 0)::float as sales from sale s
        where s.status = 'COMPLETE' and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date`, a);

    const discounts = (await this.manager.query(
      `select s.id, s.bill_no, s.bill_date, s.total::float as total, s.disc_amount::float as disc, ${who} as by_name
         from sale s ${joinWho}
        where s.status = 'COMPLETE' and s.disc_amount > 0 and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date
        order by s.disc_amount desc limit ${LIST_LIMIT}`, a))
      .map((r: any) => ({ ...r, pct: billDiscountPct(r.disc, r.total) }));

    const below = (await this.manager.query(
      `select * from (
         select s.id as sale_id, s.bill_no, s.bill_date, p.title, si.qty, p.pack,
                round((si.price * p.pack)::numeric, 2)::float as billed,
                (select round(pp.sale_price::numeric, 2)::float from product_price2 pp where pp.product_id = si.product_id and pp.eff_date <= s.bill_date::date order by pp.eff_date desc, pp.id desc limit 1) as list,
                ${who} as by_name
           from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id ${joinWho}
          where si.status = 'Complete' and si.active and p.pack > 0 and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date) x
        where list > 0 and billed < list * (1 - ${BELOW_LIST_PCT} / 100.0)
        order by (list - billed) / list desc limit ${LIST_LIMIT}`, a))
      .map((r: any) => ({ ...r, pct: pctOff(r.list, r.billed), value: Math.round(((r.list - r.billed) / r.pack) * r.qty * 100) / 100 }));

    const voids = await this.manager.query(
      `select s.id, s.bill_no, s.bill_date, s.updated_on, s.total::float as total, cu.full_name as created_name, du.full_name as voided_name,
              round(extract(epoch from (s.updated_on - s.created_on)) / 3600)::int as hours
         from sale s left join app_user cu on cu.id = s.created_by left join app_user du on du.id = s.updated_by
        where s.status = 'DISCARDED' and s.store_id = any($1::int[])
          and (s.updated_on at time zone 'Asia/Kolkata')::date >= $2::date and (s.updated_on at time zone 'Asia/Kolkata')::date < $3::date
        order by s.updated_on desc limit ${LIST_LIMIT}`, a);

    const edits = (await this.manager.query(
      `select a.id, a.occurred_on, a.details, s.id as sale_id, s.bill_no, s.bill_date, s.total::float as total, coalesce(act.full_name, u.full_name) as by_name
         from audit_event a join sale s on s.id::text = a.entity_id left join app_user u on u.id = a.user_id left join app_user act on act.id = a.acting_user_id
        where a.action = 'sale.edit' and s.store_id = any($1::int[])
          and (a.occurred_on at time zone 'Asia/Kolkata')::date >= $2::date and (a.occurred_on at time zone 'Asia/Kolkata')::date < $3::date
        order by a.occurred_on desc limit ${LIST_LIMIT}`, a))
      .map((r: any) => ({ id: r.id, on: r.occurred_on, sale_id: r.sale_id, bill_no: r.bill_no, bill_date: r.bill_date, total: r.total, by_name: r.by_name, changes: r.details?.changes ?? {}, ...readEdit(r.details?.changes) }));

    const returns = await this.manager.query(
      `select sri.id, sri.created_on, sri.qty, sri.reason, sri.status, sri.refund_mode, p.title, s.bill_no, s.bill_date, u.full_name as by_name,
              round(coalesce(sri.refund_amount, si.price * sri.qty * (1 + coalesce(si.tax_pcnt, 0) / 100.0))::numeric, 2)::float as value,
              ((sri.created_on at time zone 'Asia/Kolkata')::date - s.bill_date::date) as daysafter
         from sale_return_item sri join sale_item si on si.id = sri.sale_item_id join sale s on s.id = si.sale_id join product p on p.id = si.product_id
         left join app_user u on u.id = sri.created_by
        where sri.active and not sri.archive and s.store_id = any($1::int[])
          and (sri.created_on at time zone 'Asia/Kolkata')::date >= $2::date and (sri.created_on at time zone 'Asia/Kolkata')::date < $3::date
        order by sri.created_on desc limit ${LIST_LIMIT}`, a);

    return { totals, discounts, below, voids, edits, returns };
  }

  async week(user: any, q: { storeid?: number | null; weekstart?: string }) {
    const { businessId, owner, stores } = await this.scope(user);
    const ids = this.pick(stores, q.storeid);
    const today = istDay();
    if (q.weekstart && (!isValidDay(q.weekstart) || !isMonday(q.weekstart))) throw new BadRequestException('A week starts on a Monday.');
    const start = q.weekstart || lastFullWeek(today);
    const range = weekRange(start);
    const [cur, prev] = [await this.collect(ids, start), await this.collect(ids, addDays(start, -7))];
    const summary = summarise(cur.totals, cur);
    const before: Summary = summarise(prev.totals, prev);
    const signoffs = ids.length ? await this.manager.query(
      `select w.store_id, st.location, w.reviewed_on, w.note, u.full_name as by_name
         from weekly_review w join stores st on st.id = w.store_id join app_user u on u.id = w.reviewed_by
        where w.store_id = any($1::int[]) and w.week_start = $2::date order by st.location`, [ids, start]) : [];
    const over = isOver(start, today);
    return {
      week: range, today, over, stores, store: q.storeid ? +q.storeid : null, canSign: over && ids.length === 1 && !signoffs.length,
      signoffs: signoffs.map((s: any) => ({ storeid: s.store_id, store: String(s.location).trim(), on: s.reviewed_on, by: s.by_name, note: s.note })),
      pending: stores.filter((s) => ids.includes(s.id) && !signoffs.some((x: any) => x.store_id === s.id)).map((s) => s.location),
      summary, before, marked: marked(cur), limits: { belowList: BELOW_LIST_PCT, bigDiscount: BIG_DISCOUNT_PCT, lateReturnDays: LATE_RETURN_DAYS, lateVoidHours: LATE_VOID_HOURS, listLimit: LIST_LIMIT },
      discounts: cur.discounts, below: cur.below, voids: cur.voids, edits: cur.edits, returns: cur.returns,
      returnsByReason: groupReturns(cur.returns, (r) => r.reason), returnsByPerson: groupReturns(cur.returns, (r) => r.by_name),
      owner, businessId,
    };
  }

  async signoff(user: any, body: any) {
    const { businessId, stores } = await this.scope(user);
    const storeid = Number(body?.storeid);
    if (!storeid) throw new BadRequestException('Choose the store you are signing for.');
    const ids = this.pick(stores, storeid);
    const start = String(body?.weekstart ?? '');
    if (!isValidDay(start) || !isMonday(start)) throw new BadRequestException('A week starts on a Monday.');
    if (!isOver(start, istDay())) throw new BadRequestException('That week is not over yet. Review it from the Monday after.');
    const note = String(body?.note ?? '').trim().slice(0, 300) || null;
    const data = await this.collect(ids, start);
    const snapshot = { ...summarise(data.totals, data), marked: marked(data) };
    const rows = await this.manager.query(
      `insert into weekly_review (business_id, store_id, week_start, reviewed_by, note, snapshot) values ($1, $2, $3::date, $4, $5, $6::jsonb)
       on conflict (store_id, week_start) do nothing returning id`, [businessId, storeid, start, user.id, note, JSON.stringify(snapshot)]);
    if (!rows.length) throw new BadRequestException('That week is already signed for this store.');
    const store = stores.find((s) => s.id === storeid)!;
    await this.audit.record({
      userId: user.id, action: 'review.signed', entityType: 'review', entityId: rows[0].id,
      summary: `Weekly review signed: ${store.location}, week of ${start}`, details: { week: start, store: store.location, ...snapshot },
    });
    return { id: rows[0].id };
  }
}

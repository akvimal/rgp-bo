import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { cashSummary, topAsked, topLookups } from './review-extras';
import { GRACE_DAYS, LAPSED_DAYS, MIN_EVENTS, USUAL_WEEKS, callEffect, compareCohort, expectations, pick, refillHistoryFrom, summarise as summariseCohort } from './review-refill';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { isOwnerRole } from 'src/core/roles';
import {
  Daily, MIN_PEER_BILLS, PEER_TOLERANCE, Person, addRaw, comparePeople, historyFrom, mtdCompare, phasesOf, ratesOf, roundRaw, usualWeek, verdictsOf, weekDays, yearAgo, yearCompare, yearFrom, zeroRaw,
} from './review-compare';
import {
  BELOW_LIST_PCT, BIG_DISCOUNT_PCT, LATE_RETURN_DAYS, LATE_VOID_HOURS, LIST_LIMIT,
  addDays, billDiscountPct, groupReturns, isMonday, isOver, isValidDay, lastFullWeek, marked, pctOff, readEdit, summarise, weekRange,
} from './review-rules';
import { glanceOf } from './review-glance';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

/**
 * The weekly exceptions review. For one week (Monday to Sunday) and the stores the reader may see: the bills with a discount, the lines billed below
 * the list price, the bills cancelled and the returns, set beside the week before, and the sign-off that the people who run the store looked at them.
 */
@Injectable()
export class ReviewService {
  private readonly log = new Logger('WeeklyReview');
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

  /**
   * Per-day totals for the stores between two days (the second not included): bills, sales, discount, billed items, items below list, and the discards,
   * edits and returns by the day they happened. The same measure is used for the week and for what is usual, so the two are comparable.
   */
  private async daily(ids: number[], from: string, to: string): Promise<Daily[]> {
    if (!ids.length) return [];
    const a = [ids, from, to];
    const day = (col: string) => `to_char((${col})::date, 'YYYY-MM-DD')`;
    const ist = (col: string) => `to_char((${col} at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')`;
    const inIst = (col: string) => `(${col} at time zone 'Asia/Kolkata')::date >= $2::date and (${col} at time zone 'Asia/Kolkata')::date < $3::date`;
    const [sales, lines, below, voids, edits, returns, firsts, inquiries, lookups] = await Promise.all([
      this.manager.query(
        `select ${day('s.bill_date')} as day, count(*)::int as bills, coalesce(sum(s.total), 0)::float as sales,
                coalesce(sum(s.disc_amount), 0)::float as disc, count(*) filter (where s.disc_amount > 0)::int as disc_bills,
                count(*) filter (where s.customer_id is not null)::int as named
           from sale s where s.status = 'COMPLETE' and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date group by 1`, a),
      this.manager.query(
        `select ${day('s.bill_date')} as day, count(*)::int as n,
                coalesce(sum(si.price * si.qty) filter (where pii.ptr_cost > 0), 0)::float as costed_sales,
                coalesce(sum(pii.ptr_cost / greatest(p.pack, 1) * si.qty) filter (where pii.ptr_cost > 0), 0)::float as cost,
                count(*) filter (where p.more_props->>'generic' = 'true')::int as generic
           from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id
                left join purchase_invoice_item pii on pii.id = si.purchase_item_id
          where si.status = 'Complete' and si.active and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date group by 1`, a),
      this.manager.query(
        `select day, count(*)::int as n from (
           select ${day('s.bill_date')} as day, round((si.price * p.pack)::numeric, 2) as billed,
                  (select round(pp.sale_price::numeric, 2) from product_price2 pp where pp.product_id = si.product_id and pp.eff_date <= s.bill_date::date order by pp.eff_date desc, pp.id desc limit 1) as list
             from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id
            where si.status = 'Complete' and si.active and p.pack > 0 and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date) x
          where list > 0 and billed < list * (1 - ${BELOW_LIST_PCT} / 100.0) group by day`, a),
      this.manager.query(
        `select ${ist('s.updated_on')} as day, count(*)::int as n from sale s
          where s.status = 'DISCARDED' and s.store_id = any($1::int[]) and ${inIst('s.updated_on')} group by 1`, a),
      this.manager.query(
        `select ${ist('a.occurred_on')} as day, count(*)::int as n from audit_event a join sale s on s.id::text = a.entity_id
          where a.action = 'sale.edit' and s.store_id = any($1::int[]) and ${inIst('a.occurred_on')} group by 1`, a),
      this.manager.query(
        `select ${ist('sri.created_on')} as day, count(*)::int as n,
                coalesce(sum(round(coalesce(sri.refund_amount, si.price * sri.qty * (1 + coalesce(si.tax_pcnt, 0) / 100.0))::numeric, 2)), 0)::float as value
           from sale_return_item sri join sale_item si on si.id = sri.sale_item_id join sale s on s.id = si.sale_id
          where sri.active and not sri.archive and s.store_id = any($1::int[]) and ${inIst('sri.created_on')} group by 1`, a),
      // customers whose first bill at these stores fell on the day
      this.manager.query(
        `select to_char(first_day, 'YYYY-MM-DD') as day, count(*)::int as n from (
           select s.customer_id, min(s.bill_date::date) as first_day from sale s
            where s.status = 'COMPLETE' and s.customer_id is not null and s.store_id = any($1::int[]) group by 1) f
          where first_day >= $2::date and first_day < $3::date group by 1`, a),
      // requests and inquiries raised, and those closed as not available
      this.manager.query(
        `select ${ist('q.raised_on')} as day, count(*)::int as n, count(*) filter (where q.outcome = 'NOT_AVAILABLE')::int as unmet
           from customer_inquiry q where q.store_id = any($1::int[]) and ${inIst('q.raised_on')} group by 1`, a),
      // brand checks at the counter, and those with no match in stock (the table comes with migration 177)
      this.safe('brand checks', () => this.manager.query(
        `select ${ist('b.created_on')} as day, count(*)::int as n, count(*) filter (where b.outcome in ('OTHER_FORM', 'NOT_STOCKED', 'NOT_FOUND'))::int as no_match
           from brand_lookup_event b where b.store_id = any($1::int[]) and ${inIst('b.created_on')} group by 1`, a)),
    ]);
    const m = new Map<string, Daily>();
    const at = (d: string) => { let r = m.get(d); if (!r) { r = { ...zeroRaw(), day: d }; m.set(d, r); } return r; };
    for (const r of sales) { const o = at(r.day); o.bills = r.bills; o.sales = r.sales; o.disc = r.disc; o.discBills = r.disc_bills; o.named = r.named; }
    for (const r of lines) { const o = at(r.day); o.lines = r.n; o.costedSales = r.costed_sales; o.cost = r.cost; o.genericLines = r.generic; }
    for (const r of firsts) at(r.day).newCust = r.n;
    for (const r of inquiries) { const o = at(r.day); o.inquiries = r.n; o.unmet = r.unmet; }
    for (const r of lookups ?? []) { const o = at(r.day); o.lookups = r.n; o.noMatch = r.no_match; }
    for (const r of below) at(r.day).below = r.n;
    for (const r of voids) at(r.day).voids = r.n;
    for (const r of edits) at(r.day).edits = r.n;
    for (const r of returns) { const o = at(r.day); o.returns = r.n; o.returnValue = r.value; }
    return [...m.values()];
  }

  /** the week's totals for each person: bills by who made them (the person at the counter, when someone else is logged in), discards, edits and returns by who did them */
  private async people(ids: number[], from: string, to: string): Promise<Person[]> {
    if (!ids.length) return [];
    const a = [ids, from, to];
    const who = `coalesce(s.acting_user_id, s.created_by)`;
    const inIst = (col: string) => `(${col} at time zone 'Asia/Kolkata')::date >= $2::date and (${col} at time zone 'Asia/Kolkata')::date < $3::date`;
    const [sales, lines, below, voids, edits, returns] = await Promise.all([
      this.manager.query(
        `select ${who} as uid, count(*)::int as bills, coalesce(sum(s.total), 0)::float as sales, coalesce(sum(s.disc_amount), 0)::float as disc,
                count(*) filter (where s.disc_amount > 0)::int as disc_bills
           from sale s where s.status = 'COMPLETE' and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date group by 1`, a),
      this.manager.query(
        `select ${who} as uid, count(*)::int as n,
                coalesce(sum(si.price * si.qty) filter (where pii.ptr_cost > 0), 0)::float as costed_sales,
                coalesce(sum(pii.ptr_cost / greatest(p.pack, 1) * si.qty) filter (where pii.ptr_cost > 0), 0)::float as cost
           from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id
                left join purchase_invoice_item pii on pii.id = si.purchase_item_id
          where si.status = 'Complete' and si.active and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date group by 1`, a),
      this.manager.query(
        `select uid, count(*)::int as n from (
           select ${who} as uid, round((si.price * p.pack)::numeric, 2) as billed,
                  (select round(pp.sale_price::numeric, 2) from product_price2 pp where pp.product_id = si.product_id and pp.eff_date <= s.bill_date::date order by pp.eff_date desc, pp.id desc limit 1) as list
             from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id
            where si.status = 'Complete' and si.active and p.pack > 0 and s.store_id = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < $3::date) x
          where list > 0 and billed < list * (1 - ${BELOW_LIST_PCT} / 100.0) group by uid`, a),
      this.manager.query(
        `select s.updated_by as uid, count(*)::int as n from sale s
          where s.status = 'DISCARDED' and s.store_id = any($1::int[]) and ${inIst('s.updated_on')} group by 1`, a),
      this.manager.query(
        `select coalesce(a.acting_user_id, a.user_id) as uid, count(*)::int as n from audit_event a join sale s on s.id::text = a.entity_id
          where a.action = 'sale.edit' and s.store_id = any($1::int[]) and ${inIst('a.occurred_on')} group by 1`, a),
      this.manager.query(
        `select sri.created_by as uid, count(*)::int as n,
                coalesce(sum(round(coalesce(sri.refund_amount, si.price * sri.qty * (1 + coalesce(si.tax_pcnt, 0) / 100.0))::numeric, 2)), 0)::float as value
           from sale_return_item sri join sale_item si on si.id = sri.sale_item_id join sale s on s.id = si.sale_id
          where sri.active and not sri.archive and s.store_id = any($1::int[]) and ${inIst('sri.created_on')} group by 1`, a),
    ]);
    const m = new Map<number, Person>();
    const at = (uid: any) => { const k = Number(uid) || 0; let r = m.get(k); if (!r) { r = { ...zeroRaw(), userid: k, name: '' }; m.set(k, r); } return r; };
    for (const r of sales) { const o = at(r.uid); o.bills = r.bills; o.sales = r.sales; o.disc = r.disc; o.discBills = r.disc_bills; }
    for (const r of lines) { const o = at(r.uid); o.lines = r.n; o.costedSales = r.costed_sales; o.cost = r.cost; }
    for (const r of below) at(r.uid).below = r.n;
    for (const r of voids) at(r.uid).voids = r.n;
    for (const r of edits) at(r.uid).edits = r.n;
    for (const r of returns) { const o = at(r.uid); o.returns = r.n; o.returnValue = r.value; }
    const uids = [...m.keys()].filter((k) => k > 0);
    const names = uids.length ? await this.manager.query(`select id, full_name from app_user where id = any($1::int[])`, [uids]) : [];
    for (const p of m.values()) p.name = names.find((n: any) => +n.id === p.userid)?.full_name || (p.userid ? `User ${p.userid}` : '(not recorded)');
    return [...m.values()];
  }

  /** an extra that depends on a table an older database may not have: when it fails the section is left out, not the whole review */
  private async safe<T>(what: string, f: () => Promise<T>): Promise<T | null> {
    try { return await f(); } catch (e: any) { this.log.warn(`weekly review: ${what} left out (${e?.message ?? e})`); return null; }
  }

  /** the cash drawer by shift, pay-later dues, and what customers asked for that could not be supplied, for the week */
  private async extras(ids: number[], start: string, next: string, today: string) {
    if (!ids.length) return { cash: null, dues: null, asked: null, lookups: null };
    const a = [ids, start, next];
    const cash = await this.safe('cash', async () => {
      const rows = await this.manager.query(
        `select sh.id, to_char(sh.shift_date, 'YYYY-MM-DD') as shift_date, sh.name, st.location as store, sh.status, sh.expected_cash::float as expected, sh.counted_cash::float as counted,
                sh.variance::float as variance, u.full_name as who
           from store_shifts sh join stores st on st.id = sh.store_id left join app_user u on u.id = coalesce(sh.accountable_user_id, sh.assigned_user_id)
          where sh.store_id = any($1::int[]) and sh.shift_date >= $2::date and sh.shift_date < $3::date and not sh.archive order by sh.shift_date, sh.id`, a);
      return cashSummary(rows.map((r: any) => ({ ...r, store: String(r.store).trim() })), today);
    });
    const dues = await this.safe('dues', async () => {
      const [wk] = await this.manager.query(
        `select coalesce(sum(amount) filter (where kind = 'DUE'), 0)::float as given, coalesce(-sum(amount) filter (where kind = 'PAYMENT'), 0)::float as collected
           from customer_due_entry where store_id = any($1::int[]) and entry_date >= $2::date and entry_date < $3::date`, a);
      const [bal] = await this.manager.query(
        `select count(*) filter (where b > 0)::int as owing, coalesce(sum(b) filter (where b > 0), 0)::float as outstanding from (
           select customer_id, sum(amount) as b from customer_due_entry where store_id = any($1::int[]) and entry_date < $2::date group by 1) x`, [ids, next]);
      return { given: wk.given, collected: wk.collected, owing: bal.owing, outstanding: bal.outstanding };
    });
    const asked = await this.safe('asked', async () => {
      const [t] = await this.manager.query(
        `select count(*)::int as raised, count(*) filter (where outcome = 'NOT_AVAILABLE')::int as unmet, count(*) filter (where outcome = 'ORDERED')::int as ordered,
                count(*) filter (where outcome = 'SOLD')::int as sold
           from customer_inquiry where store_id = any($1::int[]) and (raised_on at time zone 'Asia/Kolkata')::date >= $2::date and (raised_on at time zone 'Asia/Kolkata')::date < $3::date`, a);
      const [od] = await this.manager.query(`select count(*)::int as n from customer_inquiry where store_id = any($1::int[]) and status = 'OPEN' and due_on < $2::date`, [ids, today]);
      const products = await this.manager.query(
        `select product_text from customer_inquiry where store_id = any($1::int[]) and outcome = 'NOT_AVAILABLE' and product_text is not null
            and (raised_on at time zone 'Asia/Kolkata')::date >= $2::date and (raised_on at time zone 'Asia/Kolkata')::date < $3::date`, a);
      return { ...t, overdue: od.n, top: topAsked(products) };
    });
    // brand checks at the counter: how many, how many had no match in stock, and which brands were checked most often with no match
    const lookups = await this.safe('brand checks', async () => {
      const [t] = await this.manager.query(
        `select count(*)::int as total, count(*) filter (where outcome = 'IN_STOCK')::int as in_stock,
                count(*) filter (where outcome in ('OTHER_FORM', 'NOT_STOCKED', 'NOT_FOUND'))::int as no_match
           from brand_lookup_event where store_id = any($1::int[]) and (created_on at time zone 'Asia/Kolkata')::date >= $2::date and (created_on at time zone 'Asia/Kolkata')::date < $3::date`, a);
      const rows = await this.manager.query(
        `select text, composition, outcome from brand_lookup_event where store_id = any($1::int[]) and outcome in ('OTHER_FORM', 'NOT_STOCKED', 'NOT_FOUND')
            and (created_on at time zone 'Asia/Kolkata')::date >= $2::date and (created_on at time zone 'Asia/Kolkata')::date < $3::date`, a);
      return { total: t.total, inStock: t.in_stock, noMatch: t.no_match, top: topLookups(rows) };
    });
    return { cash, dues, asked, lookups };
  }

  /**
   * Refill capture: of the customers whose refill fell due in the week before, and in the week itself, how many came back in time; against the weeks before
   * them; and whether a call made a difference. Worked out from the bills as of today (see review-refill.ts). Null when there is nothing to report.
   */
  private async refill(ids: number[], start: string, today: string) {
    if (!ids.length) return null;
    return this.safe('refill capture', async () => {
      const from = refillHistoryFrom(start);
      const visits = (await this.manager.query(
        `select s.customer_id, to_char(s.bill_date::date, 'YYYY-MM-DD') as d, max(s.store_id) as store_id, coalesce(sum(si.total), 0)::float as val
           from sale s join sale_item si on si.sale_id = s.id join product p on p.id = si.product_id join customer c on c.id = s.customer_id
          where s.status = 'COMPLETE' and p.more_props->>'chronic' = 'true' and c.mobile ~ '^[0-9]{10}$' and c.mobile <> '0000000000'
            and s.bill_date >= $1::date and s.bill_date < ($2::date + 1)
          group by s.customer_id, s.bill_date::date`, [from, today]))
        .map((r: any) => ({ customerId: +r.customer_id, day: r.d, storeId: r.store_id === null ? null : +r.store_id, value: r.val }));
      const exps = expectations(visits, today);
      const prevFrom = addDays(start, -7), prevTo = addDays(start, -1);
      const usualFrom = addDays(prevFrom, -7 * USUAL_WEEKS), usualTo = addDays(prevFrom, -1);
      const week = pick(exps, start, addDays(start, 6), ids), prev = pick(exps, prevFrom, prevTo, ids), usualRows = pick(exps, usualFrom, usualTo, ids);
      if (!week.length && !prev.length && !usualRows.length) return null;
      const usual = summariseCohort(usualRows, usualFrom, usualTo);
      const prevSum = summariseCohort(prev, prevFrom, prevTo);
      const followups = (await this.manager.query(
        `select customer_id, to_char((created_on at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as d, outcome from refill_followup
          where (created_on at time zone 'Asia/Kolkata')::date >= $1::date - 7`, [usualFrom]))
        .map((r: any) => ({ customerId: +r.customer_id, day: r.d, outcome: r.outcome }));
      return {
        prev: { ...prevSum, ...compareCohort(prevSum, usual) },
        thisWeek: summariseCohort(week, start, addDays(start, 6)),
        usual,
        calls: callEffect(usualRows.concat(prev), followups, today),
        rules: { graceDays: GRACE_DAYS, lapsedDays: LAPSED_DAYS, usualWeeks: USUAL_WEEKS, minEvents: MIN_EVENTS },
      };
    });
  }

  async week(user: any, q: { storeid?: number | null; weekstart?: string }) {
    const { businessId, owner, stores } = await this.scope(user);
    const ids = this.pick(stores, q.storeid);
    const today = istDay();
    if (q.weekstart && (!isValidDay(q.weekstart) || !isMonday(q.weekstart))) throw new BadRequestException('A week starts on a Monday.');
    const start = q.weekstart || lastFullWeek(today);
    const range = weekRange(start);
    const cur = await this.collect(ids, start);
    const summary = summarise(cur.totals, cur);
    // the week beside what is usual for the same days of the month (not beside the week before, which in a peak month is not like for like)
    const days = weekDays(start);
    const history = await this.daily(ids, historyFrom(start), range.next);
    const inWeek = history.filter((d) => d.day >= start && d.day < range.next);
    const actualRaw = roundRaw(inWeek.reduce((a, d) => addRaw(a, d), zeroRaw()));
    const usual = usualWeek(days, history);
    const usualRaw = usual.raw;
    const phases = phasesOf(days);
    // the same dates a year ago (52 weeks back, so the days of the week line up), and each person against the others this week
    const mtd = mtdCompare(history, range.end, today);
    const yearHistory = await this.daily(ids, yearFrom(start, mtd.from), addDays(yearAgo(range.end), 1));
    const peers = comparePeople(await this.people(ids, start, range.next));
    const more = await this.extras(ids, start, range.next, today);
    const refill = await this.refill(ids, start, today);
    const signoffs = ids.length ? await this.manager.query(
      `select w.store_id, st.location, w.reviewed_on, w.note, u.full_name as by_name
         from weekly_review w join stores st on st.id = w.store_id join app_user u on u.id = w.reviewed_by
        where w.store_id = any($1::int[]) and w.week_start = $2::date order by st.location`, [ids, start]) : [];
    const over = isOver(start, today);
    return {
      week: range, today, over, stores, store: q.storeid ? +q.storeid : (ids.length === 1 ? ids[0] : null), canSign: over && ids.length === 1 && !signoffs.length,
      signoffs: signoffs.map((s: any) => ({ storeid: s.store_id, store: String(s.location).trim(), on: s.reviewed_on, by: s.by_name, note: s.note })),
      pending: stores.filter((s) => ids.includes(s.id) && !signoffs.some((x: any) => x.store_id === s.id)).map((s) => s.location),
      summary, marked: marked(cur),
      phases,
      actual: { raw: actualRaw, rates: ratesOf(actualRaw) },
      usual: usualRaw ? { raw: usualRaw, rates: ratesOf(usualRaw), months: (usual as any).months } : { raw: null, rates: null, reason: (usual as any).reason },
      verdicts: verdictsOf(actualRaw, usualRaw),
      glance: glanceOf({ summary, marked: marked(cur), verdicts: verdictsOf(actualRaw, usualRaw) as any, cash: (more as any)?.cash ?? null }),
      mtd,
      yearAgo: yearCompare(yearHistory, start, mtd),
      people: peers,
      more,
      refill,
      peerRules: { minBills: MIN_PEER_BILLS, tolerance: PEER_TOLERANCE }, limits: { belowList: BELOW_LIST_PCT, bigDiscount: BIG_DISCOUNT_PCT, lateReturnDays: LATE_RETURN_DAYS, lateVoidHours: LATE_VOID_HOURS, listLimit: LIST_LIMIT },
      discounts: cur.discounts, below: cur.below, voids: cur.voids, edits: cur.edits, returns: cur.returns,
      returnsByReason: groupReturns(cur.returns, (r) => r.reason), returnsByPerson: groupReturns(cur.returns, (r) => r.by_name),
      owner, businessId,
    };
  }

  async signoff(user: any, body: any) {
    const { businessId, stores } = await this.scope(user);
    // a business with one store has nothing to choose: that store is the one being signed for
    const storeid = Number(body?.storeid) || (stores.length === 1 ? stores[0].id : 0);
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

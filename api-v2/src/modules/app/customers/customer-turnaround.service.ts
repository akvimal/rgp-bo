import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { isManagerRole } from 'src/core/roles';
import { DEFAULT_WINDOWS, TBill, TContact, TWindows, dayIndexOfText, dayTextOfIndex, evaluate, istDayIndex, summarise, summariseByPerson } from './customer-turnaround-rules';

const MAX_ROWS = 300;
const DEFAULT_DAYS = 30;
const MAX_RANGE_DAYS = 400;

/**
 * The contacts made in a period (all, or one person's) and what became of each. Credit goes to the latest contact before a bill, so every contact on those
 * customers from the start of the period on is read, by anyone: someone else's contact (or one after the period) can take a bill from one inside it.
 * Shared with the Refills page so both show the same numbers.
 */
export async function loadTurnaround(manager: EntityManager, from: string, to: string, only: number | null, windows: TWindows) {
    const crows = await manager.query(
      `select l.id, l.customer_id, l.created_by, l.created_on, l.audience, l.outcome, l.source, l.due_on::text as due_on,
              c.name as customer, u.full_name as by_name
         from customer_contact_log l join customer c on c.id = l.customer_id left join app_user u on u.id = l.created_by
        where (l.created_on at time zone 'Asia/Kolkata')::date between $1::date and $2::date and ($3::int is null or l.created_by = $3::int)
        order by l.created_on desc, l.id desc`, [from, to, only]);
    const contacts: TContact[] = crows.map((r: any) => ({
      id: +r.id, customerId: +r.customer_id, userId: +r.created_by, at: new Date(r.created_on), audience: r.audience, outcome: r.outcome, source: r.source, dueOn: r.due_on ? String(r.due_on).slice(0, 10) : null,
    }));

    // the bills that could answer them, and every contact on those customers from the start of the period on, by anyone: credit goes to the latest contact
    // before a bill, so a contact by someone else (or after the period) can take a bill from one inside it
    let all: TContact[] = contacts;
    let bills: TBill[] = [];
    if (contacts.length) {
      const ids = [...new Set(contacts.map((c) => c.customerId))];
      const orows = await manager.query(
        `select l.id, l.customer_id, l.created_by, l.created_on, l.audience, l.outcome, l.source, l.due_on::text as due_on from customer_contact_log l
          where l.customer_id = any($1::int[]) and (l.created_on at time zone 'Asia/Kolkata')::date >= $2::date`, [ids, from]);
      all = orows.map((r: any) => ({ id: +r.id, customerId: +r.customer_id, userId: +r.created_by, at: new Date(r.created_on), audience: r.audience, outcome: r.outcome, source: r.source, dueOn: r.due_on ? String(r.due_on).slice(0, 10) : null }));
      const brows = await manager.query(
        `select s.customer_id, s.bill_date as at, sum(si.total)::float as value, coalesce(bool_or(p.more_props->>'chronic' = 'true'), false) as chronic
           from sale s join sale_item si on si.sale_id = s.id join product p on p.id = si.product_id
          where s.status = 'COMPLETE' and s.customer_id = any($1::int[]) and (s.bill_date at time zone 'Asia/Kolkata')::date >= $2::date
          group by s.id, s.customer_id, s.bill_date`, [ids, from]);
      bills = brows.map((r: any) => ({ customerId: +r.customer_id, at: new Date(r.at), value: Number(r.value) || 0, chronic: !!r.chronic }));
    }

    const mine = new Set(contacts.map((c) => c.id));
    const results = evaluate(all, bills, windows).filter((r) => mine.has(r.contact.id));
  return { crows, results };
}

/**
 * Turnaround: of the customers contacted in a period, who bought again within the window (docs/planning/REFILL_CRM_DASHBOARD.md, step 2). A person sees
 * their own contacts; a manager (Business Head, Owner-operator, Store Head) sees everyone's and can look at one person. The rules are in customer-turnaround-rules.ts.
 */
@Injectable()
export class CustomerTurnaroundService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  /** the windows in days: a refill reminder, and any other reason to get in touch (shop settings, with the plan's defaults) */
  async windows(): Promise<TWindows> {
    const get = async (key: string, fallback: number, max: number) => {
      const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive limit 1`, [key]);
      const n = Math.round(Number(r?.setting_value));
      return Number.isFinite(n) && n >= 1 && n <= max ? n : fallback;
    };
    return { refillDays: await get('turnaround_refill_days', DEFAULT_WINDOWS.refillDays, 60), lapsedDays: await get('turnaround_lapsed_days', DEFAULT_WINDOWS.lapsedDays, 90) };
  }

  private range(q: { from?: string; to?: string }): { from: string; to: string } {
    const ok = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    const today = istDayIndex(new Date());
    const to = q.to === undefined || q.to === '' ? dayTextOfIndex(today) : q.to;
    const from = q.from === undefined || q.from === '' ? dayTextOfIndex(today - DEFAULT_DAYS + 1) : q.from;
    if (!ok(from) || !ok(to)) throw new BadRequestException('Give the dates as YYYY-MM-DD.');
    if (dayIndexOfText(to) < dayIndexOfText(from)) throw new BadRequestException('The end date is before the start date.');
    if (dayIndexOfText(to) - dayIndexOfText(from) > MAX_RANGE_DAYS) throw new BadRequestException(`Choose a period of up to ${MAX_RANGE_DAYS} days.`);
    return { from, to };
  }

  async report(user: any, q: { from?: string; to?: string; userid?: string | number }) {
    const { from, to } = this.range(q);
    // the people who oversee a business or a store see everyone's contacts; anyone else sees their own
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const team = isManagerRole(role?.name);
    // a person who does not see the team sees only their own contacts, whatever is asked
    const only = team ? (q.userid ? Number(q.userid) : null) : Number(user.id);
    if (only !== null && !Number.isInteger(only)) throw new BadRequestException('Choose a person from the list.');
    const windows = await this.windows();

    const { crows, results } = await loadTurnaround(this.manager, from, to, only, windows);
    const names = new Map<number, { customer: string; by: string }>(crows.map((r: any) => [+r.id, { customer: r.customer, by: r.by_name }]));
    const rows = results.slice(0, MAX_ROWS).map((r) => ({
      id: r.contact.id, customer_id: r.contact.customerId, customer: names.get(r.contact.id)?.customer || null, by: names.get(r.contact.id)?.by || null, user_id: r.contact.userId,
      contacted_on: r.contact.at, audience: r.contact.audience, source: r.contact.source, outcome: r.contact.outcome,
      status: r.status, kind: r.kind, window_days: r.windowDays,
      bill_on: r.billAt ?? null, bill_value: r.value ?? null, days_to_return: r.daysToReturn ?? null, days_after_due: r.daysAfterDue ?? null, days_left: r.daysLeft ?? null,
    }));
    return {
      from, to, windows,
      scope: team && only === null ? 'team' : 'person',
      totals: summarise(results),
      byPerson: team ? summariseByPerson(results).map((p) => ({ user_id: p.userId, name: crows.find((r: any) => +r.created_by === p.userId)?.by_name || null, ...p.summary })) : undefined,
      rows, truncated: results.length > MAX_ROWS,
    };
  }
}

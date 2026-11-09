import { ForbiddenException, BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { businessOfUser } from 'src/core/business-of-user';
import { isOwnerRole, ROLE } from 'src/core/roles';
import { istDay } from 'src/modules/app/todos/todo-rules';
import { CalendarEntry, CalendarType, clipToWindow, sortEntries, typesAsked, windowProblem } from './calendar-rules';

/** the licence kinds as people say them (the same words as the vendor list) */
const LICENCE_NAME: Record<string, string> = {
  WHOLESALE_20B_21B: 'Wholesale drug licence', RETAIL_20_21: 'Retail drug licence', MANUFACTURING: 'Manufacturing licence', FSSAI: 'FSSAI licence', OTHER: 'Licence',
};
const licenceName = (t: string) => LICENCE_NAME[t] ?? t;

interface Me { id: number; roleId: number; owner: boolean; head: boolean; business: number | null; stores: number[]; storeNames: Map<number, string> }

/**
 * The calendar: one read-only list of what is dated across the app (leave, holidays, to-dos, licences, stock audits, Schedule-drug follow-ups, your own attendance).
 * Nothing here is stored; every kind is a small query over the table that owns it, and each shows only what the person may already see on the owning screen.
 */
@Injectable()
export class CalendarService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async can(roleId: number | string, resource: string, action: string): Promise<boolean> {
    const [r] = await this.manager.query(
      `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                       where r.id = $1 and e->>'resource' = $2 and p->>'action' = $3) as can`, [roleId, resource, action]);
    return !!r?.can;
  }

  private async me(user: any): Promise<Me> {
    const [u] = await this.manager.query(`select u.id, r.name as role, r.id as role_id from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [user.id]);
    if (!u) throw new ForbiddenException();
    const owner = isOwnerRole(u.role);
    const business = await businessOfUser(this.manager, u.id);
    const rows = owner && business
      ? await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive`, [business])
      : await this.manager.query(`select s.id, s.location from user_stores us join stores s on s.id = us.store_id where us.user_id = $1 and us.active and not us.archive and s.active and not s.archive`, [u.id]);
    return {
      id: u.id, roleId: u.role_id, owner, head: u.role === ROLE.STORE_HEAD, business,
      stores: rows.map((s: any) => s.id), storeNames: new Map<number, string>(rows.map((s: any) => [s.id, s.location] as [number, string])),
    };
  }

  /** the stores this person may look at: all of the business for an owner, their own otherwise; a store filter can only narrow it */
  private storesFor(me: Me, storeId?: number | null): number[] {
    return storeId ? me.stores.filter((s) => s === storeId) : me.stores;
  }

  async options(user: any) {
    const me = await this.me(user);
    return {
      stores: [...me.storeNames].map(([id, name]) => ({ id, name })),
      manager: me.owner || me.head,
      types: await this.typesFor(me),
    };
  }

  /** the kinds this person can have at all (so the filter chips do not offer what would always be empty) */
  private async typesFor(me: Me): Promise<CalendarType[]> {
    const t: CalendarType[] = ['holiday', 'leave', 'attendance'];
    if (await this.can(me.roleId, 'todos', 'view')) t.push('todo');
    if (me.owner || me.head) t.push('licence');
    if (await this.can(me.roleId, 'stockaudit', 'view')) t.push('audit');
    if (await this.can(me.roleId, 'scheduleregister', 'view')) t.push('followup');
    return t;
  }

  async entries(user: any, q: { from: string; to: string; store?: string; types?: string }) {
    const problem = windowProblem(q.from, q.to);
    if (problem) throw new BadRequestException(problem);
    const me = await this.me(user);
    const storeId = q.store ? +q.store : null;
    if (storeId && !me.stores.includes(storeId)) throw new ForbiddenException('That store is not yours to look at.');
    const stores = this.storesFor(me, storeId);
    const allowed = await this.typesFor(me);
    const asked = typesAsked(q.types).filter((t) => allowed.includes(t));
    const win = { from: q.from, to: q.to };
    const today = istDay();

    const run: Record<CalendarType, () => Promise<CalendarEntry[]>> = {
      holiday: () => this.holidays(win),
      leave: () => this.leave(me, stores, storeId, win),
      todo: () => this.todos(me, stores, storeId, win, today),
      licence: () => this.licences(me, stores, win, today),
      audit: () => this.audits(stores, win),
      followup: () => this.followups(me, stores, storeId, win),
      attendance: () => this.attendance(me, win),
    };
    const lists = await Promise.all(asked.map((t) => run[t]()));
    return { from: q.from, to: q.to, today, entries: sortEntries(lists.flat()) };
  }

  // ---------------------------------------------------------------- the kinds
  private async holidays(w: { from: string; to: string }): Promise<CalendarEntry[]> {
    const rows = await this.manager.query(`select holiday_date::text as d, name from hr_holiday where holiday_date between $1 and $2`, [w.from, w.to]);
    return rows.map((r: any) => ({ id: `holiday-${r.d}`, type: 'holiday', title: r.name, start: r.d, end: r.d, tone: 'muted' } as CalendarEntry));
  }

  private async leave(me: Me, stores: number[], storeId: number | null, w: { from: string; to: string }): Promise<CalendarEntry[]> {
    const rows = await this.manager.query(
      `select r.id, r.from_date::text as f, r.to_date::text as t, r.half_day, r.status, r.reason, e.user_id, u.full_name, e.store_id, lt.name as leave_type
         from hr_leave_request r
         join hr_employee e on e.id = r.employee_id
         join hr_leave_type lt on lt.id = r.leave_type_id
         left join app_user u on u.id = e.user_id
        where r.status in ('APPROVED', 'PENDING') and r.from_date <= $2 and r.to_date >= $1
          and (e.store_id = any($3::int[]) or ($4::int is null and e.user_id = $5))`, [w.from, w.to, stores, storeId, me.id]);
    const manager = me.owner || me.head;
    const out: CalendarEntry[] = [];
    for (const r of rows) {
      const mine = r.user_id === me.id;
      // the team sees who is off (approved); a request still waiting, and its reason, is for its owner and the managers
      if (!mine && !manager && r.status !== 'APPROVED') continue;
      const span = clipToWindow(r.f, r.t, w.from, w.to);
      if (!span) continue;
      const pending = r.status === 'PENDING';
      out.push({
        id: `leave-${r.id}`, type: 'leave', start: span.start, end: span.end,
        title: `${r.full_name || 'Staff'} - ${r.leave_type}${r.half_day ? ' (half day)' : ''}${pending ? ' - waiting' : ''}`,
        who: r.full_name, storeId: r.store_id, store: me.storeNames.get(r.store_id) ?? null, status: r.status,
        link: manager ? '/secure/leave-approvals' : mine ? '/secure/my-hr' : null, tone: pending ? 'warn' : 'info',
        note: manager || mine ? r.reason : null,
      });
    }
    return out;
  }

  private async todos(me: Me, stores: number[], storeId: number | null, w: { from: string; to: string }, today: string): Promise<CalendarEntry[]> {
    if (!me.business) return [];
    const rows = await this.manager.query(
      `select t.id, t.title, t.status, t.priority, t.pool, t.store_id, t.assignee_user_id, a.full_name as assignee,
              to_char(t.due_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d, to_char(t.due_on at time zone 'Asia/Kolkata', 'HH24:MI') as tm
         from todo_item t left join app_user a on a.id = t.assignee_user_id
        where t.business_id = $1 and not t.archive and t.status in ('OPEN', 'DONE')
          and (t.due_on at time zone 'Asia/Kolkata')::date between $2 and $3
          and ($4::int is null or t.store_id = $4)
          and (t.assignee_user_id = $5 or (t.store_id = any($6::int[]) and (t.pool or $7::boolean)))`,
      [me.business, w.from, w.to, storeId, me.id, stores, me.owner || me.head]);
    return rows.map((r: any) => {
      const done = r.status === 'DONE';
      return {
        id: `todo-${r.id}`, type: 'todo', title: r.title, start: r.d, end: r.d, time: r.tm === '00:00' ? null : r.tm,
        who: r.pool ? 'Store pool' : r.assignee, storeId: r.store_id, store: me.storeNames.get(r.store_id) ?? null, status: r.status, link: '/secure/todos',
        tone: done ? 'muted' : r.d < today ? 'bad' : r.priority === 'high' ? 'warn' : 'info',
      } as CalendarEntry;
    });
  }

  private async licences(me: Me, stores: number[], w: { from: string; to: string }, today: string): Promise<CalendarEntry[]> {
    if (!(me.owner || me.head)) return [];
    const soon = istDay(new Date(Date.now() + 30 * 86400000));
    const toneOf = (d: string): CalendarEntry['tone'] => (d < today ? 'bad' : d <= soon ? 'warn' : 'info');
    const out: CalendarEntry[] = [];
    const store = await this.manager.query(
      `select l.id, l.license_type, l.number, l.valid_to::text as d, l.store_id from store_license l where l.store_id = any($1::int[]) and l.valid_to between $2 and $3`, [stores, w.from, w.to]);
    for (const r of store) {
      out.push({ id: `licence-s${r.id}`, type: 'licence', title: `${licenceName(r.license_type)} ${r.number} ${r.d < today ? 'expired' : 'expires'}`, start: r.d, end: r.d,
        storeId: r.store_id, store: me.storeNames.get(r.store_id) ?? null, link: '/secure/settings/stores', tone: toneOf(r.d) });
    }
    if (me.owner) {
      const vendor = await this.manager.query(
        `select l.id, l.license_type, l.number, l.valid_to::text as d, v.business_name from vendor_license l join vendor v on v.id = l.vendor_id
          where not v.archive and coalesce(v.active, true) and l.valid_to between $1 and $2`, [w.from, w.to]);
      for (const r of vendor) {
        out.push({ id: `licence-v${r.id}`, type: 'licence', title: `${r.business_name}: ${licenceName(r.license_type)} ${r.number} ${r.d < today ? 'expired' : 'expires'}`, start: r.d, end: r.d,
          link: '/secure/vendors', tone: toneOf(r.d) });
      }
    }
    return out;
  }

  private async audits(stores: number[], w: { from: string; to: string }): Promise<CalendarEntry[]> {
    const rows = await this.manager.query(
      `select a.id, a.category, a.status, a.due_on::text as d, a.store_id, s.location, u.full_name as assignee
         from stock_audit a join stores s on s.id = a.store_id left join app_user u on u.id = a.assigned_to
        where a.store_id = any($1::int[]) and a.due_on between $2 and $3 and a.status <> 'SKIPPED'`, [stores, w.from, w.to]);
    return rows.map((r: any) => ({
      id: `audit-${r.id}`, type: 'audit', title: `Stock audit${r.category ? ' - ' + r.category : ''}`, start: r.d, end: r.d, who: r.assignee,
      storeId: r.store_id, store: r.location, status: r.status, link: '/secure/stock-audits', tone: r.status === 'DONE' ? 'ok' : r.status === 'IN_PROGRESS' ? 'info' : 'warn',
    } as CalendarEntry));
  }

  private async followups(me: Me, stores: number[], storeId: number | null, w: { from: string; to: string }): Promise<CalendarEntry[]> {
    if (!me.business) return [];
    const rows = await this.manager.query(
      `select f.id, f.status, f.due_on::text as d, f.store_id, c.name as customer
         from schedule_rx_followup f join customer c on c.id = f.customer_id
        where f.business_id = $1 and f.due_on between $2 and $3 and f.status <> 'CANCELLED'
          and ($4::int is null or f.store_id = $4) and (f.store_id is null or f.store_id = any($5::int[]))`, [me.business, w.from, w.to, storeId, stores]);
    return rows.map((r: any) => ({
      id: `followup-${r.id}`, type: 'followup', title: `Prescription follow-up${r.customer ? ' - ' + r.customer : ''}`, start: r.d, end: r.d,
      storeId: r.store_id, store: me.storeNames.get(r.store_id) ?? null, status: r.status, link: '/secure/schedule-register', tone: r.status === 'OPEN' ? 'warn' : 'ok',
    } as CalendarEntry));
  }

  /** your own attendance only; a manager sees the team's on the attendance review screen */
  private async attendance(me: Me, w: { from: string; to: string }): Promise<CalendarEntry[]> {
    const rows = await this.manager.query(
      `select a.id, a.att_date::text as d, a.status, to_char(a.check_in at time zone 'Asia/Kolkata', 'HH24:MI') as tm
         from hr_attendance a join hr_employee e on e.id = a.employee_id where e.user_id = $1 and a.att_date between $2 and $3`, [me.id, w.from, w.to]);
    const label: Record<string, string> = { PRESENT: 'Present', ABSENT: 'Absent', HALF_DAY: 'Half day', WEEKLY_OFF: 'Weekly off', HOLIDAY: 'Holiday' };
    const tone: Record<string, CalendarEntry['tone']> = { PRESENT: 'ok', ABSENT: 'bad', HALF_DAY: 'warn', WEEKLY_OFF: 'muted', HOLIDAY: 'muted' };
    return rows.map((r: any) => ({
      id: `attendance-${r.id}`, type: 'attendance', title: `${label[r.status] ?? r.status}${r.tm ? ' (in ' + r.tm + ')' : ''}`, start: r.d, end: r.d, who: 'You',
      status: r.status, link: '/secure/my-hr', tone: tone[r.status] ?? 'muted',
    } as CalendarEntry));
  }
}

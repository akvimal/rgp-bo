import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ConfigService } from 'src/core/config/config.service';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { addDays, isRequired, itemOf, ITEMS, ladderFor, Step, stepOf, waiverEnd } from './compliance-rules';
import { lastFullWeek } from '../review/review-rules';

const TZ = 'Asia/Kolkata';
const STOCK_COUNT_EVERY = 14;
const OUTAGE_EVERY = 7;
const FRESH_MS = 2 * 60 * 1000;
const SEVERITY: Record<string, number> = { escalated: 0, late: 1, due: 2, reminder: 3, waived: 4, done: 5 };

interface Owed { item_key: string; store_id: number | null; person_id: number | null; period_key: string; due_on: string; detail?: any }
interface Who { id: number; roleName: string; owner: boolean; manager: boolean; businessId: number; storeIds: number[] }

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);
  private lastSync = new Map<number, number>();

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private async today(): Promise<string> {
    const [r] = await this.manager.query(`select (now() at time zone '${TZ}')::date::text as d`);
    return r.d;
  }

  private async who(user: any): Promise<Who> {
    const businessId = await businessOfUser(this.manager, user?.id || 0);
    if (!businessId) throw new ForbiddenException('Your user is not linked to a business.');
    const roleId = user?.roleid || (await this.manager.query(`select role_id from app_user where id = $1`, [user?.id || 0]))[0]?.role_id || 0;
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [roleId]);
    const owner = isOwnerRole(role?.name);
    const rows = owner
      ? await this.manager.query(`select id as store_id from stores where business_id = $1 and active and not archive`, [businessId])
      : await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { id: user.id, roleName: role?.name, owner, manager: isManagerRole(role?.name), businessId, storeIds: rows.map((r: any) => +r.store_id) };
  }

  // ------------------------------------------------------------------ generators: what is owed now, from facts that already exist
  // Set-based on purpose: a sync is a handful of queries however many stores and items there are.

  private async generate(businessId: number, today: string): Promise<{ keys: string[]; owed: Owed[] }> {
    const m = this.manager;
    const owed: Owed[] = [];
    const active = await m.query(
      `select s.id, s.location from stores s where s.business_id = $1 and s.active and not s.archive
          and exists (select 1 from sale x where x.store_id = s.id and x.created_on >= current_date - 60)`, [businessId]);
    const ids: number[] = active.map((s: any) => +s.id);
    const lastCount = new Map<number, string>((await m.query(
      `select store_id, to_char(max(completed_on at time zone '${TZ}'), 'YYYY-MM-DD') as last from stock_count where status = 'COMPLETED' and store_id = any($1::int[]) group by 1`, [ids])).map((r: any) => [+r.store_id, r.last]));
    const lastOutage = new Map<number, string>((await m.query(
      `select store_id, to_char(max(checked_on at time zone '${TZ}'), 'YYYY-MM-DD') as last from outage_readiness_log where store_id = any($1::int[]) group by 1`, [ids])).map((r: any) => [+r.store_id, r.last]));
    const week = lastFullWeek(today);
    const reviewed = new Set<number>((await m.query(`select store_id from weekly_review where week_start = $1::date and store_id = any($2::int[])`, [week, ids])).map((r: any) => +r.store_id));

    for (const s of active) {
      const store = String(s.location).trim();
      const c = lastCount.get(+s.id) || null;
      owed.push({ item_key: 'stock_count', store_id: s.id, person_id: null, period_key: c || 'never', due_on: c ? addDays(c, STOCK_COUNT_EVERY) : addDays(today, STOCK_COUNT_EVERY), detail: { store, last: c } });
      const o = lastOutage.get(+s.id) || null;
      owed.push({ item_key: 'outage_check', store_id: s.id, person_id: null, period_key: o || 'never', due_on: o ? addDays(o, OUTAGE_EVERY) : addDays(today, OUTAGE_EVERY), detail: { store, last: o } });
      if (!reviewed.has(+s.id)) owed.push({ item_key: 'weekly_review', store_id: s.id, person_id: null, period_key: week, due_on: addDays(week, 7), detail: { store, week } });
    }

    const lic = await m.query(
      `select l.store_id, st.location, l.license_type, l.number, to_char(l.valid_to, 'YYYY-MM-DD') as valid_to
         from store_license l join stores st on st.id = l.store_id
        where st.business_id = $1 and st.active and not st.archive and l.valid_to is not null
          and l.valid_to = (select max(x.valid_to) from store_license x where x.store_id = l.store_id and x.license_type = l.license_type)`, [businessId]);
    for (const l of lic) owed.push({ item_key: 'licence', store_id: l.store_id, person_id: null, period_key: `${l.license_type}:${l.valid_to}`, due_on: l.valid_to, detail: { store: String(l.location).trim(), type: l.license_type, number: l.number, valid_to: l.valid_to } });

    const shifts = await m.query(
      `select sh.id, sh.store_id, coalesce(sh.accountable_user_id, sh.opened_by) as person, sh.name, to_char(sh.shift_date, 'YYYY-MM-DD') as day
         from store_shifts sh join stores st on st.id = sh.store_id
        where st.business_id = $1 and sh.status = 'OPEN' and sh.shift_date < $2::date`, [businessId, today]);
    for (const sh of shifts) owed.push({ item_key: 'shift_close', store_id: sh.store_id, person_id: sh.person, period_key: String(sh.id), due_on: addDays(sh.day, 1), detail: { shift: sh.name, day: sh.day } });

    const parked = await m.query(
      `select s.id, s.store_id, coalesce(s.acting_user_id, s.created_by) as person, s.bill_no, s.total::float as total,
              to_char(s.created_on at time zone '${TZ}', 'YYYY-MM-DD') as day
         from sale s join stores st on st.id = s.store_id
        where st.business_id = $1 and s.status = 'PENDING' and (s.created_on at time zone '${TZ}')::date < $2::date`, [businessId, today]);
    for (const p of parked) owed.push({ item_key: 'parked_bill', store_id: p.store_id, person_id: p.person, period_key: String(p.id), due_on: addDays(p.day, 1), detail: { bill: p.bill_no || p.id, total: p.total, day: p.day } });

    return { keys: ITEMS.map((i) => i.key), owed };
  }

  // ------------------------------------------------------------------ sync: open what is owed, close what is not, move the steps

  @Cron(CronExpression.EVERY_10_MINUTES, { timeZone: TZ })
  async tick() {
    try {
      const biz = await this.manager.query(`select id from business where active and not archive`);
      for (const b of biz) await this.sync(b.id);
    } catch (e: any) { this.logger.error(`compliance sync failed: ${e?.message}`); }
  }

  async sync(businessId: number): Promise<void> {
    const today = await this.today();
    const cfg = await this.config.valuesFor(businessId, 'compliance');
    const { keys, owed } = await this.generate(businessId, today);
    const m = this.manager;
    const idOf = (r: { item_key: string; store_id: any; person_id: any; period_key: string }) => `${r.item_key}|${r.store_id ?? 0}|${r.person_id ?? 0}|${r.period_key}`;

    // open what is owed and already worth listing (one statement), noting which are new
    const seen = new Set<string>(owed.map(idOf));
    const list = owed.filter((o) => {
      const def = itemOf(o.item_key)!;
      return stepOf({ dueOn: o.due_on, today, remindDays: def.remindDays, ...ladderFor(def, cfg) }) !== null;
    });
    if (list.length) {
      const ins = await m.query(
        `insert into compliance_instance (business_id, store_id, person_id, item_key, period_key, due_on, detail)
         select $1, t.store_id, t.person_id, t.item_key, t.period_key, t.due_on, t.detail::jsonb
           from unnest($2::int[], $3::int[], $4::text[], $5::text[], $6::date[], $7::text[]) as t(store_id, person_id, item_key, period_key, due_on, detail)
         on conflict (business_id, item_key, coalesce(store_id, 0), coalesce(person_id, 0), period_key)
         do update set detail = excluded.detail, person_id = coalesce(compliance_instance.person_id, excluded.person_id)
         returning id, (xmax = 0) as inserted`,
        [businessId, list.map((o) => o.store_id), list.map((o) => o.person_id), list.map((o) => o.item_key), list.map((o) => o.period_key), list.map((o) => o.due_on), list.map((o) => JSON.stringify(o.detail ?? null))]);
      const fresh = ins.filter((r: any) => r.inserted).map((r: any) => r.id);
      if (fresh.length) await m.query(`insert into compliance_event (instance_id, kind) select unnest($1::int[]), 'opened'`, [fresh]);
    }

    // what is open for these items: no longer owed means done; the rest may have moved on the ladder
    const open = await m.query(
      `select i.id, i.item_key, i.store_id, i.person_id, i.period_key, i.due_on::text as due_on, i.step,
              (select max(w.until)::text from compliance_waiver w where w.instance_id = i.id and w.status = 'GRANTED') as waived_until
         from compliance_instance i where i.business_id = $1 and i.state = 'OPEN' and i.item_key = any($2::text[])`, [businessId, keys]);
    const closing: number[] = [];
    const moved: { id: number; step: Step }[] = [];
    for (const r of open) {
      if (!seen.has(idOf(r))) { closing.push(r.id); continue; }
      const def = itemOf(r.item_key)!;
      const step = stepOf({ dueOn: r.due_on, today, remindDays: def.remindDays, waivedUntil: r.waived_until, ...ladderFor(def, cfg) });
      if (step && step !== r.step) moved.push({ id: r.id, step });
    }
    if (closing.length) {
      await m.query(`update compliance_instance set state = 'DONE', step = 'done', closed_on = now(), step_on = now() where id = any($1::int[])`, [closing]);
      await m.query(`insert into compliance_event (instance_id, kind) select unnest($1::int[]), 'closed'`, [closing]);
    }
    if (moved.length) {
      await m.query(`update compliance_instance i set step = t.step, step_on = now() from unnest($1::int[], $2::text[]) as t(id, step) where i.id = t.id`, [moved.map((x) => x.id), moved.map((x) => x.step)]);
      await m.query(`insert into compliance_event (instance_id, kind, note) select t.id, 'step', t.step from unnest($1::int[], $2::text[]) as t(id, step)`, [moved.map((x) => x.id), moved.map((x) => x.step)]);
    }
    this.lastSync.set(businessId, Date.now());
  }

  private async fresh(businessId: number) {
    if (Date.now() - (this.lastSync.get(businessId) || 0) > FRESH_MS) await this.sync(businessId);
  }

  /** the Business Head asks for the register to be brought up to date now, instead of waiting for the next run */
  async syncNow(user: any) {
    const w = await this.who(user);
    if (!w.owner) throw new ForbiddenException('Only the Business Head can refresh the register.');
    await this.sync(w.businessId);
    return { ok: true };
  }

  // ------------------------------------------------------------------ reading

  private async rows(w: Who, scope: 'mine' | 'store') {
    const rows = await this.manager.query(
      `select i.id, i.item_key, i.store_id, st.location, i.person_id, u.full_name as person_name, to_char(i.due_on, 'YYYY-MM-DD') as due_on, i.step, i.detail, i.not_mine,
              (select jsonb_build_object('status', x.status, 'reason', x.reason, 'until', to_char(x.until, 'YYYY-MM-DD'), 'days', x.days)
                 from compliance_waiver x where x.instance_id = i.id order by x.id desc limit 1) as waiver
         from compliance_instance i
         left join stores st on st.id = i.store_id
         left join app_user u on u.id = i.person_id
        where i.business_id = $1 and i.state = 'OPEN' and i.step is not null
          and (i.store_id is null or i.store_id = any($2::int[]))`, [w.businessId, w.storeIds]);
    const mine = (r: any) => {
      const def = itemOf(r.item_key);
      if (!def) return false;
      if (r.person_id === w.id) return true;
      if (r.person_id) return false;
      if (def.owner === 'owner') return w.owner;
      if (def.owner === 'store_head') return w.manager;
      return false;
    };
    const cfg = await this.config.valuesFor(w.businessId, 'compliance');
    const today = await this.today();
    const kept = scope === 'mine' ? rows.filter(mine) : (w.manager ? rows : []);
    return kept
      .map((r: any) => {
        const def = itemOf(r.item_key)!;
        const waivedUntil = r.waiver?.status === 'GRANTED' ? r.waiver.until : null;
        return { ...r, label: def.label, cls: def.cls, owner: def.owner, required: isRequired(def, cfg, { dueOn: r.due_on, today, waivedUntil }) };
      })
      .sort((a: any, b: any) => (SEVERITY[a.step] ?? 9) - (SEVERITY[b.step] ?? 9) || (a.due_on < b.due_on ? -1 : 1));
  }

  /** the person's own items; a store head also gets the store's, the Business Head the business's */
  async mine(user: any) { const w = await this.who(user); await this.fresh(w.businessId); return this.rows(w, 'mine'); }

  /** every open item in the user's stores, for those who oversee them */
  async store(user: any) {
    const w = await this.who(user);
    if (!w.manager) throw new ForbiddenException('The register of the store is for the Business Head and the Store Head.');
    await this.fresh(w.businessId);
    return this.rows(w, 'store');
  }

  /** counts by step and class for the dashboards; a person sees the count of their own items, a manager of the store's */
  async summary(user: any) {
    const w = await this.who(user);
    await this.fresh(w.businessId);
    const list = await this.rows(w, w.manager ? 'store' : 'mine');
    const by = (k: string) => list.reduce((a: any, r: any) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
    const needs = list.filter((r: any) => ['due', 'late', 'escalated'].includes(r.step) && !r.not_mine).length;
    return { total: list.length, needs, bySteps: by('step'), byClass: by('cls'), can: { request: w.manager, decide: w.owner } };
  }

  // ------------------------------------------------------------------ acting

  private async visible(w: Who, id: number) {
    const [r] = await this.manager.query(`select * from compliance_instance where id = $1 and business_id = $2 and state = 'OPEN'`, [id, w.businessId]);
    if (!r) throw new NotFoundException('That item is no longer open.');
    if (r.store_id && !w.storeIds.includes(+r.store_id)) throw new ForbiddenException('That item belongs to another store.');
    return r;
  }

  /** "this is not mine": it is flagged for the store head and held out of the person's count */
  async notMine(user: any, id: number, note?: string) {
    const w = await this.who(user);
    const r = await this.visible(w, id);
    if (r.person_id !== w.id && !w.manager) throw new ForbiddenException('You can only say that about your own item.');
    await this.manager.query(`update compliance_instance set not_mine = true where id = $1`, [id]);
    await this.manager.query(`insert into compliance_event (instance_id, kind, actor_id, note) values ($1, 'not_mine', $2, $3)`, [id, w.id, (note || '').slice(0, 300) || null]);
    await this.audit.record({ userId: w.id, action: 'compliance.not_mine', entityType: 'compliance', entityId: id, summary: 'Marked an item as not theirs' });
    return { ok: true };
  }

  /** a store head (or the Business Head) asks for a waiver and says why */
  async requestWaiver(user: any, id: number, reason: string) {
    const w = await this.who(user);
    if (!w.manager) throw new ForbiddenException('Only a store head or the Business Head can ask for a waiver.');
    const text = String(reason || '').trim();
    if (text.length < 3) throw new BadRequestException('Say why the waiver is needed.');
    await this.visible(w, id);
    const [pending] = await this.manager.query(`select id from compliance_waiver where instance_id = $1 and status = 'REQUESTED'`, [id]);
    if (pending) throw new BadRequestException('A waiver has already been asked for and is waiting for the Business Head.');
    await this.manager.query(`insert into compliance_waiver (instance_id, requested_by, reason) values ($1,$2,$3)`, [id, w.id, text.slice(0, 300)]);
    await this.manager.query(`insert into compliance_event (instance_id, kind, actor_id, note) values ($1, 'waiver_asked', $2, $3)`, [id, w.id, text.slice(0, 300)]);
    await this.audit.record({ userId: w.id, action: 'compliance.waiver_request', entityType: 'compliance', entityId: id, summary: 'Asked for a waiver', details: { reason: text } });
    return { ok: true };
  }

  /** only the Business Head decides: a number of days, held inside the longest the business allows */
  async decideWaiver(user: any, id: number, body: { grant?: boolean; days?: number; note?: string }) {
    const w = await this.who(user);
    if (!w.owner) throw new ForbiddenException('Only the Business Head grants or declines a waiver.');
    await this.visible(w, id);
    const today = await this.today();
    const [pending] = await this.manager.query(`select id, reason from compliance_waiver where instance_id = $1 and status = 'REQUESTED' order by id desc limit 1`, [id]);
    const note = String(body?.note || '').slice(0, 300) || null;
    if (body?.grant === false) {
      if (!pending) throw new BadRequestException('There is no waiver request to decline.');
      await this.manager.query(`update compliance_waiver set status = 'DECLINED', decided_by = $2, decided_on = now(), decision_note = $3 where id = $1`, [pending.id, w.id, note]);
      await this.manager.query(`insert into compliance_event (instance_id, kind, actor_id, note) values ($1, 'waiver_declined', $2, $3)`, [id, w.id, note]);
      await this.audit.record({ userId: w.id, action: 'compliance.waiver_decline', entityType: 'compliance', entityId: id, summary: 'Declined a waiver' });
      return { ok: true, status: 'DECLINED' };
    }
    const max = Number((await this.config.valuesFor(w.businessId, 'compliance')).waiver_max_days) || 7;
    const end = waiverEnd(today, Number(body?.days), max);
    if (!end.ok) throw new BadRequestException(end.error);
    if (!note && !pending) throw new BadRequestException('Say why the waiver is granted.');
    if (pending) {
      await this.manager.query(`update compliance_waiver set status = 'GRANTED', decided_by = $2, decided_on = now(), days = $3, until = $4::date, decision_note = $5 where id = $1`, [pending.id, w.id, body.days, end.until, note]);
    } else {
      await this.manager.query(`insert into compliance_waiver (instance_id, status, requested_by, reason, decided_by, decided_on, days, until, decision_note) values ($1,'GRANTED',$2,$3,$2,now(),$4,$5::date,$3)`, [id, w.id, note, body.days, end.until]);
    }
    await this.manager.query(`insert into compliance_event (instance_id, kind, actor_id, note) values ($1, 'waiver_granted', $2, $3)`, [id, w.id, `until ${end.until}${note ? ': ' + note : ''}`]);
    await this.audit.record({ userId: w.id, action: 'compliance.waiver_grant', entityType: 'compliance', entityId: id, summary: `Granted a waiver until ${end.until}`, details: { days: body.days, until: end.until, note } });
    await this.sync(w.businessId);
    return { ok: true, status: 'GRANTED', until: end.until };
  }

  // ------------------------------------------------------------------ "do this to continue": the gate at shift open and close

  /**
   * The items a person must do, or give a reason for, before this step: before opening a shift, their own unclosed shift of an earlier day; before
   * closing a shift, the store's stock count once it is far enough overdue. An item is out of the way when it is waived, done, or already has a reason today.
   */
  async gate(user: any, storeId: number, phase: 'open' | 'close') {
    const w = await this.who(user);
    if (storeId && !w.storeIds.includes(storeId) && !w.owner) return [];
    await this.fresh(w.businessId);
    const cfg = await this.config.valuesFor(w.businessId, 'compliance');
    const today = await this.today();
    const keys = ITEMS.filter((i) => i.gate?.phase === phase).map((i) => i.key);
    if (!keys.length) return [];
    const rows = await this.manager.query(
      `select i.id, i.item_key, to_char(i.due_on, 'YYYY-MM-DD') as due_on, i.step, i.detail, i.person_id,
              (select max(x.until)::text from compliance_waiver x where x.instance_id = i.id and x.status = 'GRANTED') as waived_until,
              exists (select 1 from compliance_event e where e.instance_id = i.id and e.kind = 'reason' and (e.created_on at time zone '${TZ}')::date = $4::date) as reasoned
         from compliance_instance i
        where i.business_id = $1 and i.state = 'OPEN' and i.item_key = any($2::text[])
          and ((i.person_id is null and i.store_id = $3) or i.person_id = $5)`, [w.businessId, keys, storeId || 0, today, w.id]);
    return rows
      .filter((r: any) => !r.reasoned && isRequired(itemOf(r.item_key)!, cfg, { dueOn: r.due_on, today, waivedUntil: r.waived_until }))
      .map((r: any) => ({ id: r.id, item_key: r.item_key, label: itemOf(r.item_key)!.label, due_on: r.due_on, step: r.step, detail: r.detail }));
  }

  /** Lets the step go ahead when nothing is outstanding or every outstanding item has a reason (recorded and shown to the store head); else refuses with the list. */
  async enforce(user: any, storeId: number, phase: 'open' | 'close', reasons?: Record<string, string>) {
    const items = await this.gate(user, storeId, phase);
    if (!items.length) return;
    const text = (id: number) => String((reasons || {})[String(id)] || '').trim();
    const missing = items.filter((i) => text(i.id).length < 3);
    if (missing.length) {
      throw new ConflictException({
        statusCode: 409,
        message: `Before you ${phase === 'open' ? 'open a shift' : 'close the shift'}, do ${missing.length === 1 ? 'this' : 'these'} or say why it cannot be done: ${missing.map((i) => i.label).join(', ')}.`,
        required: missing,
      });
    }
    for (const i of items) {
      await this.manager.query(`insert into compliance_event (instance_id, kind, actor_id, note) values ($1, 'reason', $2, $3)`, [i.id, user.id, text(i.id).slice(0, 300)]);
      await this.audit.record({ userId: user.id, action: 'compliance.reason', entityType: 'compliance', entityId: i.id, summary: `Went ahead without doing: ${i.label}`, details: { reason: text(i.id), phase } });
    }
  }

  async events(user: any, id: number) {
    const w = await this.who(user);
    const r = await this.visible(w, id).catch(() => null);
    if (!r) throw new NotFoundException('That item is not open.');
    if (r.person_id !== w.id && !w.manager) throw new ForbiddenException('Not yours to read.');
    return this.manager.query(`select e.kind, e.note, to_char(e.created_on at time zone '${TZ}', 'YYYY-MM-DD HH24:MI') as at, u.full_name as actor from compliance_event e left join app_user u on u.id = e.actor_id where e.instance_id = $1 order by e.id`, [id]);
  }
}

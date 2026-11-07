import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser, BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { isOwnerRole, NOT_A_PERSON, ROLE } from 'src/core/roles';
import { uploadedFilePath } from 'src/modules/app/files/upload-path';
import { sep } from 'path';
import { cleanTime, dayOf, dueInstant, firstOnOrAfter, istDay, makeOnOrAfter, nextAfter, Repeat, repeatProblem, RepeatRule, stageOf } from './todo-rules';

const PRIORITIES = ['low', 'normal', 'high'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Me { id: number; role: string; owner: boolean; head: boolean; business: number | null; storeIds: number[]; canAssign: boolean }

/**
 * The to-do list. A to-do belongs to a person, or to a store's pool (any login at that store may tick it, and the tick is credited to whoever was
 * serving). Owners give to anyone in the business, a Store Head to the people and stores of their own, everyone else keeps their own.
 * A repeat is a template that makes the next to-do when its heads-up begins; reminders are the alerts of kind todo_due.
 */
@Injectable()
export class TodoService {
  private readonly log = new Logger(TodoService.name);
  private generating = false;

  constructor(private readonly audit: AuditService, @InjectEntityManager() private readonly manager: EntityManager) {}

  // ---------------------------------------------------------------- who is asking
  async can(roleId: number | string, action: string): Promise<boolean> {
    const [r] = await this.manager.query(
      `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                       where r.id = $1 and e->>'resource' = 'todos' and p->>'action' = $2) as can`, [roleId, action]);
    return !!r?.can;
  }

  private async me(user: any): Promise<Me> {
    const [u] = await this.manager.query(`select u.id, r.name as role, r.id as role_id from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [user.id]);
    if (!u) throw new ForbiddenException();
    const stores = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [u.id]);
    return {
      id: u.id, role: u.role, owner: isOwnerRole(u.role), head: u.role === ROLE.STORE_HEAD,
      business: await businessOfUser(this.manager, u.id), storeIds: stores.map((s: any) => s.store_id),
      canAssign: await this.can(u.role_id, 'assign'),
    };
  }

  /** the people this person may give a to-do to, and the stores whose pool they may use */
  private async options(me: Me) {
    if (!me.business) return { people: [], stores: [] };
    const stores = me.owner
      ? await this.manager.query(`select id, location as name from stores where business_id = $1 and active and not archive order by id`, [me.business])
      : me.storeIds.length ? await this.manager.query(`select id, location as name from stores where id = any($1::int[]) and active and not archive order by id`, [me.storeIds]) : [];
    let people: any[] = [];
    if (me.canAssign) {
      people = me.owner
        ? await this.manager.query(
            `select u.id, u.full_name as name, r.name as role from app_user u join app_role r on r.id = u.role_id
              where u.active and not u.archive and ${BUSINESS_OF_USER_SQL} = $1 and r.name <> all($2::text[]) order by u.full_name`, [me.business, NOT_A_PERSON])
        : me.storeIds.length ? await this.manager.query(
            `select distinct u.id, u.full_name as name, r.name as role from app_user u join app_role r on r.id = u.role_id
               join user_stores us on us.user_id = u.id and us.active and not us.archive and us.store_id = any($1::int[])
              where u.active and not u.archive and r.name <> all($2::text[]) order by u.full_name`, [me.storeIds, NOT_A_PERSON]) : [];
    }
    if (!people.some((p: any) => p.id === me.id)) {
      const [self] = await this.manager.query(`select u.id, u.full_name as name, r.name as role from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [me.id]);
      if (self && !NOT_A_PERSON.includes(self.role)) people.unshift(self);
    }
    return { people, stores };
  }

  async optionsFor(user: any) {
    const me = await this.me(user);
    return { ...(await this.options(me)), canassign: me.canAssign, me: me.id };
  }

  // ---------------------------------------------------------------- reading
  private shape(r: any, me: Me, now = new Date()) {
    const open = r.status === 'OPEN';
    const mine = r.assignee_user_id === me.id;
    const atMyStore = r.store_id !== null && me.storeIds.includes(r.store_id);
    const manage = me.owner || r.created_by === me.id || r.assigned_by === me.id || (me.head && me.canAssign && (atMyStore || r.assignee_at_my_store));
    return {
      id: Number(r.id), title: r.title, notes: r.notes, priority: r.priority, status: r.status,
      dueon: r.due_on, dueday: dayOf(r.due_on), stage: open ? stageOf(r.due_on, now, r.soon_days, r.escalate_days) : 'none',
      soondays: r.soon_days, escalatedays: r.escalate_days,
      pool: r.pool, storeid: r.store_id, store: r.store_name ? String(r.store_name).trim() : null,
      assigneeuserid: r.assignee_user_id, assignee: r.assignee_name || null,
      assignedby: r.assigned_by, assignedbyname: r.assigned_by_name || null, createdby: r.created_by,
      templateid: r.template_id, repeat: r.repeat || null, repeatrule: r.template_id ? { repeat: r.repeat, days: r.repeat_days, day: r.repeat_day, every: r.repeat_every, at: r.at_time } : null,
      completedby: r.completed_by, completedbyname: r.completed_by_name || null, completedon: r.completed_on, donenote: r.done_note,
      needsproof: !!r.needs_proof, donefiles: Array.isArray(r.done_files) ? r.done_files : [],
      canmanage: manage, cantick: open && (mine || (r.pool && atMyStore) || manage),
    };
  }

  private readonly SELECT = `
    select i.*, s.location as store_name, a.full_name as assignee_name, g.full_name as assigned_by_name, c.full_name as completed_by_name,
           t.repeat, t.repeat_days, t.repeat_day, t.repeat_every, t.at_time
      from todo_item i
      left join stores s on s.id = i.store_id
      left join app_user a on a.id = i.assignee_user_id
      left join app_user g on g.id = i.assigned_by
      left join app_user c on c.id = i.completed_by
      left join todo_template t on t.id = i.template_id`;

  /** the to-dos a person sees: their own and their stores' pools ("mine"), or, for someone who gives to-dos, those of the people and stores they look after ("team") */
  async list(user: any, q: { scope?: string; status?: string }) {
    const me = await this.me(user);
    if (!me.business) return { items: [] };
    const status = q.status === 'done' ? `i.status in ('DONE', 'SKIPPED') and i.completed_on > now() - interval '30 days'`
      : q.status === 'all' ? `(i.status = 'OPEN' or i.completed_on > now() - interval '30 days')`
      : `(i.status = 'OPEN' or (i.status = 'DONE' and i.completed_on > now() - interval '2 days'))`;
    let rows: any[];
    if (q.scope === 'team') {
      if (!me.canAssign) throw new ForbiddenException('Only someone who gives out to-dos sees the team\'s.');
      const { people } = await this.options(me);
      rows = await this.manager.query(
        `${this.SELECT} where i.business_id = $1 and not i.archive and ${status}
            and ($2::boolean or i.store_id = any($3::int[]) or i.assignee_user_id = any($4::int[]) or i.created_by = $5 or i.assigned_by = $5)
          order by (i.status = 'OPEN') desc, i.due_on limit 400`, [me.business, me.owner, me.storeIds, people.map((p: any) => p.id), me.id]);
      const mine = new Set(people.map((p: any) => p.id));
      rows.forEach((r) => { r.assignee_at_my_store = r.assignee_user_id !== null && mine.has(r.assignee_user_id); });
    } else {
      rows = await this.manager.query(
        `${this.SELECT} where i.business_id = $1 and not i.archive and ${status}
            and (i.assignee_user_id = $2 or (i.pool and i.store_id = any($3::int[])))
          order by (i.status = 'OPEN') desc, i.due_on limit 400`, [me.business, me.id, me.storeIds]);
    }
    const now = new Date();
    return { items: rows.map((r) => this.shape(r, me, now)) };
  }

  private async load(me: Me, id: number | string) {
    const [r] = await this.manager.query(`${this.SELECT} where i.id = $1 and i.business_id = $2 and not i.archive`, [Number(id), me.business]);
    if (!r) throw new NotFoundException('That to-do is not here any more.');
    if (me.head && r.assignee_user_id) {
      const [x] = await this.manager.query(`select 1 as ok from user_stores where user_id = $1 and active and not archive and store_id = any($2::int[])`, [r.assignee_user_id, me.storeIds]);
      r.assignee_at_my_store = !!x;
    }
    return r;
  }

  // ---------------------------------------------------------------- giving a to-do
  /** who the to-do is for, checked against what this person may give: { assignee, pool, storeid } */
  private async target(me: Me, body: any): Promise<{ assignee: number | null; pool: boolean; storeid: number | null }> {
    const pool = body?.pool === true || body?.pool === 'true';
    const opts = await this.options(me);
    if (pool) {
      if (!me.canAssign) throw new ForbiddenException('Only a manager gives a to-do to a store\'s staff.');
      const storeid = Number(body?.storeid);
      if (!opts.stores.some((s: any) => Number(s.id) === storeid)) throw new ForbiddenException('That store is not one of yours.');
      return { assignee: null, pool: true, storeid };
    }
    const who = body?.assigneeuserid ? Number(body.assigneeuserid) : me.id;
    if (who !== me.id) {
      if (!me.canAssign) throw new ForbiddenException('You can only keep your own to-dos.');
      if (!opts.people.some((p: any) => Number(p.id) === who)) throw new ForbiddenException('You can give a to-do only to the people you look after.');
    }
    const storeid = body?.storeid ? Number(body.storeid) : null;
    if (storeid !== null && !opts.stores.some((s: any) => Number(s.id) === storeid)) throw new ForbiddenException('That store is not one of yours.');
    return { assignee: who, pool: false, storeid };
  }

  private fields(body: any) {
    const title = String(body?.title ?? '').trim();
    if (title.length < 2 || title.length > 200) throw new BadRequestException('Give the to-do a title (2 to 200 characters).');
    const priority = body?.priority ?? 'normal';
    if (!PRIORITIES.includes(priority)) throw new BadRequestException('Priority is low, normal or high.');
    const day = String(body?.dueday ?? '');
    if (!DAY_RE.test(day) || Number.isNaN(Date.parse(day))) throw new BadRequestException('Choose the day it is due.');
    const time = body?.duetime ? cleanTime(body.duetime) : '09:00';
    if (!time) throw new BadRequestException('The time should look like 09:30.');
    const soon = body?.soondays === undefined || body?.soondays === '' ? 1 : Number(body.soondays);
    const esc = body?.escalatedays === undefined || body?.escalatedays === '' ? 3 : Number(body.escalatedays);
    if (!Number.isInteger(soon) || soon < 0 || soon > 30) throw new BadRequestException('The heads-up is 0 to 30 days.');
    if (!Number.isInteger(esc) || esc < 1 || esc > 60) throw new BadRequestException('Tell the manager after 1 to 60 days late.');
    const notes = body?.notes ? String(body.notes).slice(0, 2000) : null;
    const needsproof = body?.needsproof === true || body?.needsproof === 'true';
    return { title, priority, day, time, soon, esc, notes, needsproof };
  }

  async create(user: any, body: any) {
    const me = await this.me(user);
    if (!me.business) throw new ForbiddenException();
    const f = this.fields(body);
    if (f.day < istDay(new Date(Date.now() - 86400000))) throw new BadRequestException('That day has already passed.');
    if (f.day > istDay(new Date(Date.now() + 800 * 86400000))) throw new BadRequestException('That is too far ahead.');
    const t = await this.target(me, body);
    const toOther = t.pool || t.assignee !== me.id;

    let rule: RepeatRule | null = null;
    let endsOn: string | null = null;
    if (body?.repeat && body.repeat.repeat) {
      rule = { repeat: body.repeat.repeat as Repeat, days: Array.isArray(body.repeat.days) ? body.repeat.days.map(Number) : null,
        day: body.repeat.day === undefined || body.repeat.day === null || body.repeat.day === '' ? null : Number(body.repeat.day),
        every: body.repeat.every ? Number(body.repeat.every) : null };
      const problem = repeatProblem(rule);
      if (problem) throw new BadRequestException(problem);
      if (body.repeat.endson) {
        if (!DAY_RE.test(String(body.repeat.endson)) || String(body.repeat.endson) < f.day) throw new BadRequestException('The repeat should end on or after the first day.');
        endsOn = String(body.repeat.endson);
      }
    }

    if (rule) {
      const first = firstOnOrAfter(rule, f.day);
      const [tpl] = await this.manager.query(
        `insert into todo_template (business_id, store_id, title, notes, priority, assignee_user_id, pool, assigned_by, repeat, repeat_days, repeat_day, repeat_every,
                                    at_time, starts_on, ends_on, skip_if_open, soon_days, escalate_days, next_due_on, created_by, needs_proof)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::int4[],$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning id`,
        [me.business, t.storeid, f.title, f.notes, f.priority, t.assignee, t.pool, me.id, rule.repeat, rule.days?.length ? rule.days : null, rule.day ?? null, rule.every ?? null,
          f.time, f.day, endsOn, body.repeat.skipifopen !== false, f.soon, f.esc, first, me.id, f.needsproof]);
      await this.generate(tpl.id);
      const [made] = await this.manager.query(`select id from todo_item where template_id = $1 order by id limit 1`, [tpl.id]);
      if (toOther) await this.audit.record({ userId: me.id, action: 'todo.assigned', entityType: 'todo_template', entityId: tpl.id, summary: `repeating to-do "${f.title}" given`, details: { ...t } });
      return { id: made ? Number(made.id) : null, templateid: tpl.id };
    }

    const [row] = await this.manager.query(
      `insert into todo_item (business_id, store_id, title, notes, priority, assignee_user_id, pool, assigned_by, due_on, soon_days, escalate_days, created_by, needs_proof)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [me.business, t.storeid, f.title, f.notes, f.priority, t.assignee, t.pool, me.id, dueInstant(f.day, f.time), f.soon, f.esc, me.id, f.needsproof]);
    if (toOther) await this.audit.record({ userId: me.id, action: 'todo.assigned', entityType: 'todo_item', entityId: Number(row.id), summary: `to-do "${f.title}" given`, details: { ...t } });
    return { id: Number(row.id) };
  }

  async update(user: any, id: number, body: any) {
    const me = await this.me(user);
    const r = await this.load(me, id);
    if (r.status !== 'OPEN') throw new BadRequestException('Only an open to-do can be changed.');
    if (!this.shape(r, me).canmanage) throw new ForbiddenException('Only the person who gave this to-do, or a manager, changes it.');
    const f = this.fields({ ...{ title: r.title, notes: r.notes, priority: r.priority, dueday: dayOf(r.due_on), soondays: r.soon_days, escalatedays: r.escalate_days, needsproof: r.needs_proof }, ...body,
      duetime: body?.duetime ?? new Date(r.due_on).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) });
    let t = { assignee: r.assignee_user_id as number | null, pool: !!r.pool, storeid: r.store_id as number | null };
    if (body && ('assigneeuserid' in body || 'pool' in body)) t = await this.target(me, body);
    await this.manager.query(
      `update todo_item set title = $2, notes = $3, priority = $4, due_on = $5, soon_days = $6, escalate_days = $7, assignee_user_id = $8, pool = $9, store_id = $10, needs_proof = $11 where id = $1`,
      [r.id, f.title, f.notes, f.priority, dueInstant(f.day, f.time), f.soon, f.esc, t.assignee, t.pool, t.storeid, f.needsproof]);
    return { id: Number(r.id) };
  }

  // ---------------------------------------------------------------- ticking
  async done(user: any, id: number, body: any) {
    const me = await this.me(user);
    const r = await this.load(me, id);
    if (r.status !== 'OPEN') throw new BadRequestException('That to-do is already closed.');
    if (!this.shape(r, me).cantick) throw new ForbiddenException('That to-do is not yours to tick.');
    // a shared counter login ticks for whoever was serving
    let by = me.id;
    const acting = Number(body?.actinguserid);
    if (acting && acting !== me.id) {
      const [a] = await this.manager.query(
        `select u.id from app_user u join app_role ro on ro.id = u.role_id where u.id = $1 and u.active and not u.archive and ro.name <> all($2::text[]) and ${BUSINESS_OF_USER_SQL} = $3`, [acting, NOT_A_PERSON, me.business]);
      if (a) by = a.id;
    }
    const note = body?.note ? String(body.note).trim().slice(0, 300) || null : null;
    const files = this.cleanFiles(body?.files);
    if (r.needs_proof && !files.length && (note || '').length < 3) {
      throw new BadRequestException('This to-do needs proof: add a comment, or attach a photo or a file, before it is ticked.');
    }
    await this.manager.query(
      `update todo_item set status = 'DONE', completed_by = $2, completed_on = now(), done_note = $3, done_files = $4::jsonb where id = $1 and status = 'OPEN'`,
      [r.id, by, note, files.length ? JSON.stringify(files) : null]);
    if (files.length) await this.audit.record({ userId: me.id, actingUserId: by !== me.id ? by : undefined, action: 'todo.done_with_files', entityType: 'todo_item', entityId: Number(r.id),
      summary: `to-do "${r.title}" ticked with ${files.length} file${files.length === 1 ? '' : 's'}`, details: { files: files.map((f) => f.name) } });
    if (r.template_id) await this.afterDone(r.template_id);
    return { id: Number(r.id) };
  }

  /** what was attached when ticking: up to five files that were uploaded for to-dos (the upload folder's todo area), kept with their names */
  private cleanFiles(raw: any): { path: string; name: string }[] {
    const list = Array.isArray(raw) ? raw : [];
    if (list.length > 5) throw new BadRequestException('Attach up to 5 files.');
    return list.map((f: any) => {
      const path = String(f?.path ?? '');
      const full = uploadedFilePath(path);                                   // an existing file under the upload folder, nothing else
      if (!full.includes(`${sep}todo${sep}`)) throw new BadRequestException('That file was not uploaded for a to-do.');
      return { path, name: String(f?.name ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, 120) || 'file' };
    });
  }

  /** a repeat that follows completion makes its next to-do now */
  private async afterDone(templateId: number) {
    const [t] = await this.manager.query(`select *, ends_on::text as ends_txt from todo_template where id = $1 and active and not archive`, [templateId]);
    if (!t || t.repeat !== 'EVERY_N_DAYS_AFTER_DONE') return;
    const next = nextAfter({ repeat: t.repeat, every: t.repeat_every }, istDay());
    if (!next || (t.ends_txt && next > t.ends_txt)) { await this.manager.query(`update todo_template set active = false, next_due_on = null where id = $1`, [t.id]); return; }
    await this.manager.query(`update todo_template set next_due_on = $2 where id = $1`, [t.id, next]);
    await this.generate(t.id);
  }

  async reopen(user: any, id: number) {
    const me = await this.me(user);
    const r = await this.load(me, id);
    if (r.status === 'OPEN') return { id: Number(r.id) };
    if (!(this.shape(r, me).canmanage || r.completed_by === me.id)) throw new ForbiddenException('Only the person who ticked it, or a manager, reopens it.');
    await this.manager.query(`update todo_item set status = 'OPEN', completed_by = null, completed_on = null, done_note = null, done_files = null where id = $1`, [r.id]);
    return { id: Number(r.id) };
  }

  async remove(user: any, id: number) {
    const me = await this.me(user);
    const r = await this.load(me, id);
    if (!this.shape(r, me).canmanage) throw new ForbiddenException('Only the person who gave this to-do, or a manager, removes it.');
    await this.manager.query(`update todo_item set archive = true where id = $1`, [r.id]);
    return { id: Number(r.id) };
  }

  // ---------------------------------------------------------------- repeats
  async repeats(user: any) {
    const me = await this.me(user);
    if (!me.business) return { items: [] };
    const { people } = await this.options(me);
    const rows = await this.manager.query(
      `select t.*, t.next_due_on::text as next_txt, t.ends_on::text as ends_txt, s.location as store_name, a.full_name as assignee_name from todo_template t left join stores s on s.id = t.store_id left join app_user a on a.id = t.assignee_user_id
        where t.business_id = $1 and t.active and not t.archive
          and ($2::boolean or t.created_by = $3 or t.assigned_by = $3 or t.assignee_user_id = $3 or t.store_id = any($4::int[]) or t.assignee_user_id = any($5::int[]))
        order by t.id desc`, [me.business, me.owner, me.id, me.storeIds, people.map((p: any) => p.id)]);
    return { items: rows.map((t: any) => ({
      id: t.id, title: t.title, repeat: t.repeat, days: t.repeat_days, day: t.repeat_day, every: t.repeat_every, at: t.at_time, nextdue: t.next_txt, endson: t.ends_txt,
      pool: t.pool, store: t.store_name ? String(t.store_name).trim() : null, assignee: t.assignee_name || null, missed: t.missed,
    })) };
  }

  async stopRepeat(user: any, id: number) {
    const me = await this.me(user);
    const [t] = await this.manager.query(`select * from todo_template where id = $1 and business_id = $2 and active and not archive`, [Number(id), me.business]);
    if (!t) throw new NotFoundException('That repeat is not here any more.');
    const mayStop = me.owner || t.created_by === me.id || t.assigned_by === me.id || (me.head && me.canAssign && t.store_id !== null && me.storeIds.includes(t.store_id));
    if (!mayStop) throw new ForbiddenException('Only the person who set this repeat, or a manager, stops it.');
    await this.manager.query(`update todo_template set active = false, next_due_on = null where id = $1`, [t.id]);
    return { id: t.id };
  }

  /** each few minutes: make the to-dos whose heads-up has begun */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick() {
    if (this.generating) return;
    this.generating = true;
    try { await this.generate(); } catch (e: any) { this.log.error(`To-do repeats failed: ${e?.message}`); } finally { this.generating = false; }
  }

  async generate(onlyTemplate?: number) {
    const today = istDay();
    const templates = await this.manager.query(
      `select id from todo_template where active and not archive and next_due_on is not null and next_due_on <= ($1::date + soon_days) ${onlyTemplate ? 'and id = $2' : ''}`,
      onlyTemplate ? [today, onlyTemplate] : [today]);
    for (const t of templates) {
      await this.manager.transaction(async (tx) => {
        const [lock] = await tx.query(`select *, next_due_on::text as next_txt, ends_on::text as ends_txt from todo_template where id = $1 and active for update`, [t.id]);
        if (!lock || !lock.next_txt) return;
        const rule: RepeatRule = { repeat: lock.repeat, days: lock.repeat_days, day: lock.repeat_day, every: lock.repeat_every };
        let next: string | null = lock.next_txt;
        let missed = 0, active = true, guard = 0;
        while (next && makeOnOrAfter(next, lock.soon_days) <= today && guard++ < 400) {
          if (lock.ends_txt && next > lock.ends_txt) { active = false; next = null; break; }
          const [open] = await tx.query(`select 1 as ok from todo_item where template_id = $1 and status = 'OPEN' and not archive limit 1`, [lock.id]);
          if (lock.skip_if_open && open) {
            // the last one is still open: when this day has come it has been missed; before that, wait for the last one to be done
            if (next <= today) { missed++; next = nextAfter(rule, next); continue; }
            break;
          }
          // an occurrence whose day went by while nothing was open (the system was off) is counted, not made late
          if (lock.skip_if_open && next < today) { missed++; next = nextAfter(rule, next); continue; }
          await tx.query(
            `insert into todo_item (business_id, store_id, template_id, title, notes, priority, assignee_user_id, pool, assigned_by, due_on, soon_days, escalate_days, created_by, needs_proof)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [lock.business_id, lock.store_id, lock.id, lock.title, lock.notes, lock.priority, lock.assignee_user_id, lock.pool, lock.assigned_by, dueInstant(next, lock.at_time),
              lock.soon_days, lock.escalate_days, lock.created_by, lock.needs_proof]);
          // a repeat that follows completion waits for the tick; a calendar repeat goes on to its next day
          next = lock.repeat === 'EVERY_N_DAYS_AFTER_DONE' ? null : nextAfter(rule, next);
        }
        await tx.query(`update todo_template set next_due_on = $2, missed = missed + $3, active = $4 where id = $1`, [lock.id, next, missed, active]);
      });
    }
  }
}

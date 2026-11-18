import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { ModulesService } from 'src/core/modules/modules.service';
import { isOwnerRole } from 'src/core/roles';
import { firstOnOrAfter, istDay, RepeatRule } from '../todos/todo-rules';
import { TodoService } from '../todos/todo.service';
import { ChecklistDef, ChecklistItem, cleanItems, daysSince, defaultList, DEFAULT_CHECKLISTS, isCurrent, recordRun, slugKey } from './checklist-rules';
import { lastPriceListPrint } from '../outage/price-list-last';
import { dayProblem, effectiveSetting, SYSTEM_TASKS, systemTask, TaskSetting } from './system-tasks';

const text = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

interface Who { id: number; role: string; owner: boolean; businessId: number; storeIds: number[]; canEdit: boolean }

/**
 * Store checklists and the system's weekly and monthly tasks. A checklist is a list of things to tick (the lists shipped in code, or a business's or
 * a store's own copy); a run records one filling-in. A system task is a repeating to-do in each store's pool that the system keeps in step with
 * the store's settings, and closes by itself when it can see the work was done.
 */
@Injectable()
export class ChecklistsService {
  private readonly log = new Logger(ChecklistsService.name);
  private syncing = false;

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly modules: ModulesService,
    private readonly todos: TodoService,
  ) {}

  // ------------------------------------------------------------------ who is asking
  /**
   * view: fill in the checklists (the Checklists page; the old outage kit permission still counts).
   * manage: set them up (Settings > Checklists): change, add and remove lists, switch recurring tasks on, off or to another day. It is its own
   * permission, `checklistsetup`; the owner roles hold it by name, a Store Head by grant, and only for their own stores (see scope).
   */
  async can(roleId: number | string, action: 'view' | 'manage'): Promise<boolean> {
    const [r] = await this.manager.query(
      `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                       where r.id = $1 and (($2 = 'manage' and e->>'resource' = 'checklistsetup' and p->>'action' = 'manage')
                                         or ($2 = 'view' and e->>'resource' = 'checklists' and p->>'action' = 'view')
                                         or ($2 = 'view' and e->>'resource' = 'outage'))) as can`, [roleId, action]);
    return !!r?.can;
  }

  private async who(user: any): Promise<Who> {
    const [u] = await this.manager.query(`select u.id, r.name as role, r.id as role_id from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [user.id]);
    if (!u) throw new ForbiddenException();
    const owner = isOwnerRole(u.role);
    const canManage = owner || (await this.can(u.role_id, 'manage'));
    // setting up checklists is admin work: a role that may set them up may also open the page that reads them
    if (!owner && !canManage && !(await this.can(u.role_id, 'view'))) throw new ForbiddenException('Checklists are not open to your role.');
    const businessId = await businessOfUser(this.manager, u.id);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const stores = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [u.id]);
    return { id: u.id, role: u.role, owner, businessId, storeIds: stores.map((s: any) => +s.store_id), canEdit: canManage };
  }

  /** the stores this person may look at, and the one asked for (it must be one of them) or the first */
  private async scope(user: any, storeid?: number | null) {
    const w = await this.who(user);
    const stores: { id: number; location: string }[] = (w.owner
      ? await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive order by id`, [w.businessId])
      : w.storeIds.length ? await this.manager.query(`select id, location from stores where id = any($1::int[]) and business_id = $2 and active and not archive order by id`, [w.storeIds, w.businessId]) : [])
      .map((s: any) => ({ id: +s.id, location: String(s.location).trim() }));
    const store = storeid ? stores.find((s) => s.id === +storeid) : stores[0];
    if (storeid && !store) throw new BadRequestException('That store is not one of yours.');
    return { w, stores, store: store ?? null };
  }

  private needEdit(w: Who) { if (!w.canEdit) throw new ForbiddenException('Setting up checklists and recurring tasks is for a Store Head (their own stores) or the business owner.'); }

  // ------------------------------------------------------------------ the lists
  /** the lists a store uses: each shipped list, as the store or its business changed it, and the lists the store or business added */
  private async lists(businessId: number, storeId: number | null) {
    const rows = await this.manager.query(
      `select key, title, items, active, store_id from checklist_template where business_id = $1 and (store_id is null or store_id = $2)`, [businessId, storeId]);
    const pick = (key: string) => rows.find((r: any) => r.key === key && r.store_id !== null) ?? rows.find((r: any) => r.key === key && r.store_id === null) ?? null;
    const out: (ChecklistDef & { source: 'store' | 'business' | 'default'; custom: boolean; active: boolean })[] = [];
    for (const d of DEFAULT_CHECKLISTS) {
      const r = pick(d.key);
      out.push({ ...d, title: r?.title ?? d.title, items: r?.items ?? d.items, source: r ? (r.store_id !== null ? 'store' : 'business') : 'default', custom: false, active: r ? !!r.active : true });
    }
    const customKeys = Array.from(new Set<string>(rows.filter((r: any) => !defaultList(r.key)).map((r: any) => r.key)));
    for (const k of customKeys) {
      const r = pick(k);
      out.push({ key: k, title: r.title, description: 'A checklist of your own.', every: 'WEEKLY', items: r.items, source: r.store_id !== null ? 'store' : 'business', custom: true, active: !!r.active });
    }
    return out;
  }

  private lastPriceListPrint(businessId: number) { return lastPriceListPrint(this.manager, businessId); }

  async overview(user: any, storeid?: number | null) {
    const { w, stores, store } = await this.scope(user, storeid);
    const today = istDay();
    if (!store) return { store: null, stores, lists: [], canedit: w.canEdit, owner: w.owner, today, pricelist: null };
    const lists = await this.lists(w.businessId, store.id);
    const lastRuns = async (completeOnly: boolean) => new Map<string, any>((await this.manager.query(
      `select distinct on (l.template_key) l.template_key, l.id, to_char(l.run_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day, l.run_on, l.complete, l.note, u.full_name as by_name
         from checklist_run l join app_user u on u.id = l.run_by
        where l.store_id = $1 ${completeOnly ? 'and l.complete' : ''} order by l.template_key, l.run_on desc`, [store.id])).map((r: any) => [r.template_key, r]));
    const [any, complete] = await Promise.all([lastRuns(false), lastRuns(true)]);
    const pricelist = await this.lastPriceListPrint(w.businessId);
    return {
      store, stores, canedit: w.canEdit, owner: w.owner, today, pricelist,
      pharmacy: await this.modules.packOnForBusiness(w.businessId, 'pharmacy'),
      lists: lists.map((l) => {
        const lc = complete.get(l.key) ?? null;
        return {
          key: l.key, title: l.title, description: l.description, every: l.every, source: l.source, custom: l.custom, active: l.active,
          items: (l.items as ChecklistItem[]).map((i) => ({ ...i, autoticked: i.auto === 'price_list' ? !!pricelist?.fresh : undefined })),
          last: any.get(l.key) ?? null, lastcomplete: lc, dayssince: lc ? daysSince(lc.day, today) : null, current: isCurrent(l.every, lc?.day ?? null, today),
        };
      }),
    };
  }

  async run(user: any, key: string, body: any) {
    const { w, store } = await this.scope(user, body?.storeid ? +body.storeid : null);
    if (!store) throw new BadRequestException('There is no store to check.');
    const list = (await this.lists(w.businessId, store.id)).find((l) => l.key === key && l.active);
    if (!list) throw new NotFoundException('That checklist is not here.');
    const pl = await this.lastPriceListPrint(w.businessId);
    const { items, complete } = recordRun(list.items as ChecklistItem[], body?.ticks, body?.values, { price_list: !!pl?.fresh });
    const [row] = await this.manager.query(
      `insert into checklist_run (business_id, store_id, template_key, template_title, run_by, items, complete, note) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) returning id`,
      [w.businessId, store.id, key, list.title, w.id, JSON.stringify(items), complete, text(body?.note, 300)]);
    await this.audit.record({ userId: w.id, action: 'checklist.run', entityType: 'checklist', entityId: row.id,
      summary: `${list.title} checked at ${store.location}: ${complete ? 'complete' : `${items.filter((i) => !i.ticked).length} item(s) not ready`}`, details: { key, complete } });
    let closed = 0;
    if (complete) for (const t of SYSTEM_TASKS.filter((x) => x.auto === `checklist:${key}`)) closed += await this.todos.completeSystemTask(w.businessId, [store.id], t.key, w.id, `${list.title} checked`);
    return { id: row.id, complete, closedtasks: closed };
  }

  async history(user: any, key: string, storeid?: number | null) {
    const { store } = await this.scope(user, storeid);
    if (!store) return { items: [] };
    const rows = await this.manager.query(
      `select l.id, l.run_on, l.complete, l.note, l.items, u.full_name as by_name from checklist_run l join app_user u on u.id = l.run_by
        where l.store_id = $1 and l.template_key = $2 order by l.run_on desc limit 15`, [store.id, key]);
    return { items: rows.map((r: any) => ({ id: r.id, on: r.run_on, by: r.by_name, complete: r.complete, note: r.note,
      notticked: (r.items as any[]).filter((i) => !i.ticked).map((i) => i.label), values: (r.items as any[]).filter((i) => i.value).map((i) => ({ label: i.label, value: i.value })) })) };
  }

  // ------------------------------------------------------------------ changing a list
  /** where a change is kept: this store, or (owners only) the business, which every store without its own copy follows */
  private async target(user: any, body: any) {
    const { w, store } = await this.scope(user, body?.storeid ? +body.storeid : null);
    this.needEdit(w);
    const business = body?.scope === 'business';
    if (business && !w.owner) throw new ForbiddenException('Only the owner changes the list for every store.');
    if (!business && !store) throw new BadRequestException('Choose a store.');
    return { w, store, storeId: business ? null : store!.id };
  }

  async saveList(user: any, key: string, body: any) {
    const { w, storeId } = await this.target(user, body);
    const def = defaultList(key);
    const known = (await this.lists(w.businessId, storeId)).find((l) => l.key === key);
    if (!def && !known) throw new NotFoundException('That checklist is not here.');
    const { items, problem } = cleanItems(body?.items ?? known!.items);
    if (problem) throw new BadRequestException(problem);
    const title = String(body?.title ?? known?.title ?? def!.title).trim();
    if (title.length < 2 || title.length > 120) throw new BadRequestException('Give the checklist a title (2 to 120 characters).');
    const active = body?.active === undefined ? (known?.active ?? true) : !!body.active;
    await this.upsertTemplate(w, storeId, key, title, items, active);
    await this.audit.record({ userId: w.id, action: 'checklist.changed', entityType: 'checklist', entityId: 0, summary: `Checklist "${title}" changed${storeId ? '' : ' for every store'}`, details: { key, items: items.length, active } });
    return { key };
  }

  async addList(user: any, body: any) {
    const { w, storeId } = await this.target(user, body);
    const title = String(body?.title ?? '').trim();
    if (title.length < 2 || title.length > 120) throw new BadRequestException('Give the checklist a title (2 to 120 characters).');
    const { items, problem } = cleanItems(body?.items);
    if (problem) throw new BadRequestException(problem);
    let key = slugKey(title);
    const taken = new Set((await this.lists(w.businessId, storeId)).map((l) => l.key));
    for (let n = 2; taken.has(key); n++) key = `${slugKey(title)}_${n}`.slice(0, 40);
    await this.upsertTemplate(w, storeId, key, title, items, true);
    await this.audit.record({ userId: w.id, action: 'checklist.added', entityType: 'checklist', entityId: 0, summary: `Checklist "${title}" added`, details: { key, items: items.length } });
    return { key };
  }

  /** a shipped list goes back to the shared version; a list a store added is removed */
  async resetList(user: any, key: string, q: { storeid?: string; scope?: string }) {
    const { w, storeId } = await this.target(user, q);
    const res = await this.manager.query(`delete from checklist_template where business_id = $1 and key = $2 and store_id is not distinct from $3 returning id`, [w.businessId, key, storeId]);
    if (!res.length) throw new NotFoundException('There is no changed copy of that checklist to remove.');
    await this.audit.record({ userId: w.id, action: 'checklist.reset', entityType: 'checklist', entityId: 0, summary: `Checklist "${key}" ${defaultList(key) ? 'put back to the shared list' : 'removed'}`, details: { key } });
    return { key };
  }

  private async upsertTemplate(w: Who, storeId: number | null, key: string, title: string, items: ChecklistItem[], active: boolean) {
    await this.manager.query(
      `insert into checklist_template (business_id, store_id, key, title, items, active, updated_by) values ($1, $2, $3, $4, $5::jsonb, $6, $7)
       on conflict (business_id, (coalesce(store_id, 0)), key) do update set title = excluded.title, items = excluded.items, active = excluded.active, updated_by = excluded.updated_by, updated_on = now()`,
      [w.businessId, storeId, key, title, JSON.stringify(items), active, w.id]);
  }

  // ------------------------------------------------------------------ system tasks
  /** the library for a store, with what applies to it (its own setting, the business's, or the default) and what is open now */
  async tasks(user: any, storeid?: number | null) {
    const { w, stores, store } = await this.scope(user, storeid);
    this.needEdit(w);
    if (!store) return { store: null, stores, tasks: [], canedit: w.canEdit, owner: w.owner };
    await this.sync(w.businessId, store.id);
    const pharmacy = await this.modules.packOnForBusiness(w.businessId, 'pharmacy');
    const settings = await this.manager.query(`select store_id, task_key, enabled, day from system_task_setting where business_id = $1 and (store_id is null or store_id = $2)`, [w.businessId, store.id]);
    const find = (key: string, sid: number | null): TaskSetting | undefined => { const s = settings.find((x: any) => x.task_key === key && (sid === null ? x.store_id === null : +x.store_id === sid)); return s ? { enabled: s.enabled, day: s.day } : undefined; };
    const open = await this.manager.query(`select id, system_key, due_on from todo_item where store_id = $1 and system_key is not null and status = 'OPEN' and not archive`, [store.id]);
    const done = await this.manager.query(
      `select distinct on (system_key) system_key, completed_on, u.full_name as by_name from todo_item i left join app_user u on u.id = i.completed_by
        where i.store_id = $1 and i.system_key is not null and i.status = 'DONE' order by system_key, completed_on desc`, [store.id]);
    const tpl = await this.manager.query(`select system_key, next_due_on::text as next, active from todo_template where store_id = $1 and system_key is not null and not archive`, [store.id]);
    return {
      store, stores, canedit: w.canEdit, owner: w.owner,
      tasks: SYSTEM_TASKS.filter((t) => !t.pack || pharmacy).map((t) => {
        const own = find(t.key, store.id), biz = find(t.key, null), eff = effectiveSetting(t, own, biz);
        const o = open.find((x: any) => x.system_key === t.key), d = done.find((x: any) => x.system_key === t.key), tp = tpl.find((x: any) => x.system_key === t.key);
        return {
          key: t.key, title: t.title, notes: t.notes, cadence: t.cadence, link: t.link, auto: !!t.auto, defaultday: t.day,
          enabled: eff.enabled, day: eff.day, own: !!own, businesswide: !!biz && !own,
          open: o ? { id: Number(o.id), due: o.due_on } : null, lastdone: d ? { on: d.completed_on, by: d.by_name } : null, next: tp?.active ? tp.next : null,
        };
      }),
    };
  }

  async saveTask(user: any, key: string, body: any) {
    const task = systemTask(key);
    if (!task) throw new NotFoundException('That task is not here.');
    const { w, store } = await this.scope(user, body?.storeid ? +body.storeid : null);
    this.needEdit(w);
    const wide = body?.scope === 'business';
    if (wide && !w.owner) throw new ForbiddenException('Only the owner changes a task for every store.');
    if (!wide && !store) throw new BadRequestException('Choose a store.');
    const problem = dayProblem(task, body?.day);
    if (problem) throw new BadRequestException(problem);
    const day = body?.day === undefined || body?.day === null || body?.day === '' ? null : Number(body.day);
    const sid = wide ? null : store!.id;
    await this.manager.query(
      `insert into system_task_setting (business_id, store_id, task_key, enabled, day, updated_by) values ($1, $2, $3, $4, $5, $6)
       on conflict (business_id, (coalesce(store_id, 0)), task_key) do update set enabled = excluded.enabled, day = excluded.day, updated_by = excluded.updated_by, updated_on = now()`,
      [w.businessId, sid, key, body?.enabled !== false, day, w.id]);
    await this.audit.record({ userId: w.id, action: 'checklist.task_changed', entityType: 'checklist', entityId: 0,
      summary: `System task "${task.title}" ${body?.enabled === false ? 'switched off' : 'set'}${wide ? ' for every store' : ` at ${store!.location}`}`, details: { key, enabled: body?.enabled !== false, day } });
    await this.sync(w.businessId, wide ? undefined : store!.id);
    return { key };
  }

  /** a store with a setting of its own goes back to following the business */
  async resetTask(user: any, key: string, storeid?: string) {
    const { w, store } = await this.scope(user, storeid ? +storeid : null);
    this.needEdit(w);
    if (!systemTask(key)) throw new NotFoundException('That task is not here.');
    if (!store) throw new BadRequestException('Choose a store.');
    await this.manager.query(`delete from system_task_setting where business_id = $1 and store_id = $2 and task_key = $3`, [w.businessId, store.id, key]);
    await this.sync(w.businessId, store.id);
    return { key };
  }

  /** every night: keep the stores' repeating to-dos in step with the library and the settings */
  @Cron('0 30 3 * * *')
  async nightly() {
    if (this.syncing) return;
    try {
      for (const b of await this.manager.query(`select id from business where active order by id`)) await this.sync(+b.id);
    } catch (e: any) { this.log.error(`System tasks failed: ${e?.message}`); }
  }

  /**
   * Make the repeating to-dos of a business match the library and its settings: a store (the one named, or every store that has sold in the last 60
   * days) gets one per enabled task; one switched off is stopped and its open to-do removed; one moved to another day is re-timed.
   */
  async sync(businessId: number, onlyStoreId?: number) {
    this.syncing = true;
    try {
      const today = istDay();
      const stores: { id: number }[] = onlyStoreId
        ? [{ id: onlyStoreId }]
        : await this.manager.query(
          `select s.id from stores s where s.business_id = $1 and s.active and not s.archive and exists (select 1 from sale x where x.store_id = s.id and x.created_on >= current_date - 60)`, [businessId]);
      const pharmacy = await this.modules.packOnForBusiness(businessId, 'pharmacy');
      const settings = await this.manager.query(`select store_id, task_key, enabled, day from system_task_setting where business_id = $1`, [businessId]);
      const setting = (key: string, sid: number | null): TaskSetting | undefined => { const s = settings.find((x: any) => x.task_key === key && (sid === null ? x.store_id === null : +x.store_id === sid)); return s ? { enabled: s.enabled, day: s.day } : undefined; };
      const existing = await this.manager.query(
        `select id, store_id, system_key, active, repeat, repeat_day, repeat_days from todo_template where business_id = $1 and system_key is not null and not archive`, [businessId]);
      const stop = async (id: number) => {
        await this.manager.query(`update todo_template set active = false, next_due_on = null where id = $1`, [id]);
        await this.manager.query(`update todo_item set archive = true where template_id = $1 and status = 'OPEN'`, [id]);
      };
      const wanted = new Set<string>();
      for (const s of stores) {
        for (const t of SYSTEM_TASKS) {
          if (t.pack && !pharmacy) continue;
          const eff = effectiveSetting(t, setting(t.key, s.id), setting(t.key, null));
          const ex = existing.find((e: any) => +e.store_id === +s.id && e.system_key === t.key);
          if (!eff.enabled) { if (ex?.active) await stop(ex.id); continue; }
          wanted.add(`${s.id}:${t.key}`);
          const rule: RepeatRule = t.cadence === 'WEEKLY' ? { repeat: 'WEEKLY', days: [eff.day] } : { repeat: 'MONTHLY', day: eff.day };
          const next = firstOnOrAfter(rule, today);
          const days = rule.days ?? null, dom = rule.day ?? null;
          if (!ex) {
            await this.manager.query(
              `insert into todo_template (business_id, store_id, title, notes, priority, pool, repeat, repeat_days, repeat_day, at_time, starts_on, skip_if_open, soon_days, escalate_days, next_due_on, system_key, link)
               values ($1, $2, $3, $4, $5, true, $6, $7::int4[], $8, '09:00', $9, true, $10, $11, $12, $13, $14)
               on conflict do nothing`,
              [businessId, s.id, t.title, t.notes, t.priority ?? 'normal', rule.repeat, days, dom, today, t.cadence === 'WEEKLY' ? 1 : 2, t.cadence === 'WEEKLY' ? 3 : 5, next, t.key, t.link]);
          } else {
            const same = ex.active && ex.repeat === rule.repeat && (rule.repeat === 'WEEKLY' ? (ex.repeat_days ?? [])[0] === eff.day : ex.repeat_day === eff.day);
            if (!same) {
              await this.manager.query(
                `update todo_template set active = true, repeat = $2, repeat_days = $3::int4[], repeat_day = $4, next_due_on = $5, title = $6, notes = $7, link = $8 where id = $1`,
                [ex.id, rule.repeat, days, dom, next, t.title, t.notes, t.link]);
            }
          }
        }
      }
      // a store that no longer trades (or a task the business no longer has) stops being asked
      if (!onlyStoreId) for (const e of existing) if (e.active && !wanted.has(`${e.store_id}:${e.system_key}`)) await stop(e.id);
      await this.todos.generate();
    } finally { this.syncing = false; }
  }
}

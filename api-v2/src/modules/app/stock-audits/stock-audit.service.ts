import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const SCOPES = ['ALL', 'CATEGORY', 'ROTATE'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LEAD_DAYS = 7;
const text = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const today = () => new Date().toISOString().slice(0, 10);

type Ctx = { id: number; role: string; stores: number[]; manage: boolean };

/**
 * Routine stock audits: plans say how often each store's stock is counted and what; each cycle becomes an audit with a due
 * date and an assignee. Doing the audit is the existing stock count (the count screen is opened for it), which raises the
 * adjustments for a manager to approve; the audit then records what was found.
 */
@Injectable()
export class StockAuditService {
  private readonly log = new Logger(StockAuditService.name);

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async ctx(user: any): Promise<Ctx> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    const role = r?.name || '';
    return { id: user.id, role, stores: s.map((x: any) => x.store_id), manage: role === 'Business Head' };
  }

  private visible(c: Ctx, args: any[]): string {
    if (c.manage) return 'true';
    args.push(c.id);
    const me = `$${args.length}`;
    if (c.role === 'Store Head') {
      args.push(c.stores.length ? c.stores : [0]);
      return `(a.store_id = any($${args.length}::int[]) or a.assigned_to = ${me})`;
    }
    return `a.assigned_to = ${me}`;
  }

  // ------------------------------------------------------------------ plans
  async options(user: any) {
    const c = await this.ctx(user);
    const stores = await this.manager.query(`select id, location as name from stores where active and not archive order by location`);
    const categories = await this.manager.query(`select distinct category as name from product where category is not null and btrim(category) <> '' and active and not archive order by 1`);
    const staff = c.manage ? await this.manager.query(`select u.id, u.full_name as name from app_user u where u.active and not u.archive order by u.full_name`) : [];
    return { stores, categories: categories.map((x: any) => x.name), staff, canManage: c.manage, role: c.role };
  }

  plans(user: any) {
    return this.manager.query(
      `select p.id, p.name, p.store_id, st.location as store, p.scope, p.categories, p.frequency_days, to_char(p.first_due, 'YYYY-MM-DD') as first_due, p.assigned_to, u.full_name as assigned_name, p.active
         from stock_audit_plan p left join stores st on st.id = p.store_id left join app_user u on u.id = p.assigned_to order by p.active desc, p.name`);
  }

  private async cleanPlan(b: any) {
    const name = text(b?.name, 60);
    if (!name) throw new BadRequestException('Give the plan a name.');
    const scope = String(b?.scope || 'ALL').toUpperCase();
    if (!SCOPES.includes(scope)) throw new BadRequestException('Choose what each audit covers.');
    const cats = Array.from(new Set((Array.isArray(b?.categories) ? b.categories : []).map((x: any) => String(x).trim()).filter(Boolean))).slice(0, 60) as string[];
    if (scope === 'CATEGORY' && cats.length !== 1) throw new BadRequestException('Choose the one category to audit.');
    if (scope === 'ROTATE' && cats.length < 2) throw new BadRequestException('Choose at least two categories to rotate through.');
    const freq = Math.floor(Number(b?.frequency_days));
    if (!Number.isFinite(freq) || freq < 1 || freq > 366) throw new BadRequestException('The gap between audits is 1 to 366 days.');
    if (!DATE.test(b?.first_due || '')) throw new BadRequestException('Give the date the first audit is due.');
    const storeId = Number(b?.store_id) || null;
    if (storeId) {
      const [st] = await this.manager.query(`select id from stores where id = $1 and active and not archive`, [storeId]);
      if (!st) throw new BadRequestException('That store was not found.');
    }
    const assignee = Number(b?.assigned_to) || null;
    if (assignee) {
      const [u] = await this.manager.query(`select id from app_user where id = $1 and active and not archive`, [assignee]);
      if (!u) throw new BadRequestException('That staff member was not found.');
    }
    return { name, scope, cats: scope === 'ALL' ? null : cats, freq, first: b.first_due, storeId, assignee, active: b?.active !== false };
  }

  async savePlan(id: number | null, b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only the Business Head sets up audit plans.');
    const p = await this.cleanPlan(b);
    if (id) {
      const [cur] = await this.manager.query(`select 1 from stock_audit_plan where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Plan not found.');
      await this.manager.query(
        `update stock_audit_plan set name = $2, store_id = $3, scope = $4, categories = $5, frequency_days = $6, first_due = $7, assigned_to = $8, active = $9 where id = $1`,
        [id, p.name, p.storeId, p.scope, p.cats, p.freq, p.first, p.assignee, p.active]);
    } else {
      const [r] = await this.manager.query(
        `insert into stock_audit_plan (name, store_id, scope, categories, frequency_days, first_due, assigned_to, active, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [p.name, p.storeId, p.scope, p.cats, p.freq, p.first, p.assignee, p.active, c.id]);
      id = r.id;
    }
    await this.audit.record({ userId: c.id, action: 'stock_audit.plan_saved', entityType: 'stock_audit_plan', entityId: id, summary: `Stock audit plan ${p.name}: ${p.scope.toLowerCase()} every ${p.freq} days`, details: {} });
    return { id };
  }

  // ------------------------------------------------------------------ making the audits
  /** each active plan and store gets its next audit once it is within a week of due; nothing is made while one is still open */
  async generate(by?: number) {
    const plans = await this.manager.query(`select * from stock_audit_plan where active`);
    let created = 0;
    for (const p of plans) {
      const stores = p.store_id
        ? await this.manager.query(`select id from stores where id = $1 and active and not archive`, [p.store_id])
        : await this.manager.query(`select id from stores where active and not archive`);
      for (const s of stores) {
        const [open] = await this.manager.query(`select 1 from stock_audit where plan_id = $1 and store_id = $2 and status in ('PLANNED', 'IN_PROGRESS')`, [p.id, s.id]);
        if (open) continue;
        const [last] = await this.manager.query(
          `select to_char(greatest(due_on, coalesce(completed_on::date, due_on)), 'YYYY-MM-DD') as base from stock_audit where plan_id = $1 and store_id = $2 order by due_on desc, id desc limit 1`, [p.id, s.id]);
        const due = last
          ? new Date(new Date(last.base + 'T00:00:00Z').getTime() + p.frequency_days * 86400000).toISOString().slice(0, 10)
          : new Date(p.first_due).toISOString().slice(0, 10);
        const horizon = new Date(Date.now() + LEAD_DAYS * 86400000).toISOString().slice(0, 10);
        if (due > horizon) continue;
        let category: string | null = null;
        const cats: string[] = p.categories || [];
        if (p.scope === 'CATEGORY') category = cats[0] ?? null;
        else if (p.scope === 'ROTATE' && cats.length) {
          const [n] = await this.manager.query(`select count(*)::int as n from stock_audit where plan_id = $1 and store_id = $2`, [p.id, s.id]);
          category = cats[n.n % cats.length];
        }
        const res = await this.manager.query(
          `insert into stock_audit (plan_id, store_id, category, due_on, assigned_to) values ($1,$2,$3,$4,$5) on conflict do nothing returning id`, [p.id, s.id, category, due, p.assigned_to]);
        if (res.length) created++;
      }
    }
    if (created && by) await this.audit.record({ userId: by, action: 'stock_audit.generated', entityType: 'stock_audit', entityId: null, summary: `${created} stock audit${created === 1 ? '' : 's'} planned`, details: {} });
    return { created };
  }

  /** every morning, so audits appear in good time without anyone remembering to ask */
  @Cron('0 30 5 * * *', { timeZone: 'Asia/Kolkata' })
  async generateDaily() {
    try { const r = await this.generate(); if (r.created) this.log.log(`${r.created} stock audits planned`); } catch (e) { this.log.error(`audit planning failed: ${(e as Error).message}`); }
  }

  // ------------------------------------------------------------------ list / act
  async list(q: any, user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const where: string[] = [this.visible(c, args)];
    const status = String(q?.status || 'ACTIVE').toUpperCase();
    if (status === 'ACTIVE') where.push(`a.status in ('PLANNED', 'IN_PROGRESS')`);
    else if (['PLANNED', 'IN_PROGRESS', 'DONE', 'SKIPPED'].includes(status)) { args.push(status); where.push(`a.status = $${args.length}`); }
    if (q?.mine === 'true') { args.push(c.id); where.push(`a.assigned_to = $${args.length}`); }
    if (q?.overdue === 'true') where.push(`a.status in ('PLANNED', 'IN_PROGRESS') and a.due_on < current_date`);
    if (+q?.store_id) { args.push(+q.store_id); where.push(`a.store_id = $${args.length}`); }
    return this.manager.query(
      `select a.id, a.plan_id, p.name as plan, a.store_id, st.location as store, a.category, to_char(a.due_on, 'YYYY-MM-DD') as due_on, a.status, a.assigned_to, u.full_name as assigned_name,
              a.count_id, a.started_on, a.completed_on, cb.full_name as completed_name, a.lines_counted, a.lines_changed, a.variance_units, a.variance_value::float as variance_value, a.note,
              (a.status in ('PLANNED', 'IN_PROGRESS') and a.due_on < current_date) as overdue, (a.status = 'DONE' and a.completed_on::date > a.due_on) as late
         from stock_audit a join stores st on st.id = a.store_id left join stock_audit_plan p on p.id = a.plan_id left join app_user u on u.id = a.assigned_to left join app_user cb on cb.id = a.completed_by
        where ${where.join(' and ')} order by (a.status in ('PLANNED', 'IN_PROGRESS')) desc, a.due_on asc, a.id desc limit 300`, args);
  }

  async summary(user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const vis = this.visible(c, args);
    const [s] = await this.manager.query(
      `select count(*) filter (where a.status in ('PLANNED', 'IN_PROGRESS'))::int as open,
              count(*) filter (where a.status in ('PLANNED', 'IN_PROGRESS') and a.due_on < current_date)::int as overdue,
              count(*) filter (where a.status = 'DONE' and a.completed_on >= date_trunc('month', current_date))::int as done_this_month,
              coalesce(sum(a.variance_value) filter (where a.status = 'DONE' and a.completed_on >= date_trunc('month', current_date)), 0)::float as variance_value_this_month
         from stock_audit a where ${vis}`, args);
    return s;
  }

  private async load(id: number) {
    const [a] = await this.manager.query(`select * from stock_audit where id = $1`, [id]);
    if (!a) throw new NotFoundException('Audit not found.');
    return a;
  }

  async skip(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only the Business Head can skip an audit.');
    const a = await this.load(id);
    if (!['PLANNED', 'IN_PROGRESS'].includes(a.status)) throw new BadRequestException('This audit is already finished.');
    const reason = text(b?.reason, 200);
    if (!reason) throw new BadRequestException('Say why it is being skipped.');
    await this.manager.query(`update stock_audit set status = 'SKIPPED', note = $2 where id = $1`, [id, reason]);
    await this.audit.record({ userId: c.id, action: 'stock_audit.skipped', entityType: 'stock_audit', entityId: id, summary: `Stock audit skipped: ${reason}`, details: {} });
    return { id };
  }

  async assign(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only the Business Head can reassign an audit.');
    const a = await this.load(id);
    if (!['PLANNED', 'IN_PROGRESS'].includes(a.status)) throw new BadRequestException('This audit is already finished.');
    const [u] = await this.manager.query(`select id, full_name from app_user where id = $1 and active and not archive`, [Number(b?.assigned_to)]);
    if (!u) throw new BadRequestException('Choose who will do it.');
    await this.manager.query(`update stock_audit set assigned_to = $2 where id = $1`, [id, u.id]);
    await this.audit.record({ userId: c.id, action: 'stock_audit.assigned', entityType: 'stock_audit', entityId: id, summary: `Stock audit assigned to ${u.full_name}`, details: {} });
    return { id };
  }
}

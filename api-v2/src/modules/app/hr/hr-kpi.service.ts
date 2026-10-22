import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { HrKpiEngine, checkRule, roleList } from './hr-kpi-engine.service';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** KPI measures, bands (score % -> incentive % of the month's earnings) and the monthly scoring. */
@Injectable()
export class HrKpiService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly engine: HrKpiEngine) {}

  metrics() {
    return this.manager.query(
      `select id, name, description, max_points::float as max_points, display_order, active, source, system_key, rule, min_activity, rating_scale,
              applies_types, applies_designations, applies_roles from hr_kpi_metric order by display_order, name`);
  }

  async saveMetric(id: number | null, b: any, by: any) {
    const name = String(b?.name || '').trim().slice(0, 60);
    if (!name) throw new BadRequestException('Give the measure a name.');
    const max = Number(b?.max_points);
    if (!Number.isFinite(max) || max <= 0 || max > 1000) throw new BadRequestException('Maximum points must be above 0.');
    const desc = String(b?.description || '').trim().slice(0, 200) || null;
    const source = b?.source === 'SYSTEM' ? 'SYSTEM' : 'MANUAL';
    let systemKey: string | null = null, rule: any = null;
    if (source === 'SYSTEM') {
      systemKey = String(b?.system_key || '');
      rule = checkRule(systemKey, b?.rule);
    }
    const scale = Number(b?.rating_scale ?? 5);
    if (!Number.isInteger(scale) || scale < 2 || scale > 10) throw new BadRequestException('A rating scale is from 2 to 10.');
    const minActivity = Math.max(0, Math.min(100000, Math.floor(Number(b?.min_activity) || 0)));
    const list = (v: any, upper = false) => {
      const a = (Array.isArray(v) ? v : []).map((x: any) => String(x).trim()).filter(Boolean).map((x: string) => (upper ? x.toUpperCase() : x)).slice(0, 30);
      return a.length ? a : null;
    };
    const types = list(b?.applies_types, true);
    if (types?.some((t: string) => !['FULL_TIME', 'PART_TIME'].includes(t))) throw new BadRequestException('Staff types are full time or part time.');
    const roles = roleList(b?.applies_roles);
    await this.checkRoles(roles);
    const designations = list(b?.applies_designations);
    const cols = [name, desc, max, Number(b.display_order) || 10, source, systemKey, rule ? JSON.stringify(rule) : null, minActivity, scale, types, designations, roles];
    if (id) {
      const [cur] = await this.manager.query(`select 1 from hr_kpi_metric where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Measure not found.');
      await this.manager.query(
        `update hr_kpi_metric set name = $2, description = $3, max_points = $4, display_order = $5, source = $6, system_key = $7, rule = $8::jsonb, min_activity = $9, rating_scale = $10,
                applies_types = $11, applies_designations = $12, applies_roles = $13, active = $14 where id = $1`, [id, ...cols, b.active !== false]);
    } else {
      const [r] = await this.manager.query(
        `insert into hr_kpi_metric (name, description, max_points, display_order, source, system_key, rule, min_activity, rating_scale, applies_types, applies_designations, applies_roles)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12) returning id`, cols);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'hr.kpi_metric_saved', entityType: 'hr_kpi_metric', entityId: id, summary: `KPI measure ${name} (${max} points, ${source.toLowerCase()})`, details: {} });
    return { id };
  }

  /** roles that setup can be limited to */
  roles() {
    return this.manager.query(`select name from app_role where name <> 'Site Admin' order by name`);
  }

  async checkRoles(roles: string[] | null) {
    if (!roles) return;
    const known = await this.manager.query(`select name from app_role where name = any($1::text[]) and name <> 'Site Admin'`, [roles]);
    if (known.length !== roles.length) throw new BadRequestException('One of the roles is not a role in this system.');
  }

  bands() {
    return this.manager.query(`select id, role_name, min_percent::float as min_percent, label, incentive_percent::float as incentive_percent from hr_kpi_band order by role_name nulls first, min_percent desc`);
  }

  /** one role's band set (or the default set when role_name is empty) is replaced in one go; an empty set removes a role's own bands */
  async saveBands(b: any, by: any) {
    const role = String(b?.role_name || '').trim() || null;
    await this.checkRoles(role ? [role] : null);
    const rows: any[] = Array.isArray(b?.bands) ? b.bands : [];
    const seen = new Set<number>();
    for (const x of rows) {
      const m = Number(x.min_percent), p = Number(x.incentive_percent);
      if (!Number.isFinite(m) || m < 0 || m > 100) throw new BadRequestException('A band starts between 0 and 100 per cent.');
      if (!Number.isFinite(p) || p < 0 || p > 100) throw new BadRequestException('An incentive is between 0 and 100 per cent.');
      if (!String(x.label || '').trim()) throw new BadRequestException('Every band needs a label.');
      if (seen.has(m)) throw new BadRequestException('Two bands start at the same score.');
      seen.add(m);
    }
    await this.manager.transaction(async tm => {
      await tm.query(`delete from hr_kpi_band where role_name is not distinct from $1`, [role]);
      for (const x of rows) await tm.query(`insert into hr_kpi_band (role_name, min_percent, label, incentive_percent) values ($1,$2,$3,$4)`, [role, Number(x.min_percent), String(x.label).trim().slice(0, 30), Number(x.incentive_percent)]);
    });
    await this.audit.record({ userId: by.id, action: 'hr.kpi_bands_saved', entityType: 'hr_kpi_band', entityId: null, summary: `KPI bands saved for ${role ?? 'the default set'} (${rows.length})`, details: { role, rows } });
    return { count: rows.length };
  }

  /** each person's KPI for the month: the live draft (system figures, ratings, overrides) and the frozen review if finalised */
  async month(period: string) {
    const rows = await this.engine.draft(period);
    const sales = await this.manager.query(
      `select coalesce(s.acting_user_id, s.created_by) as uid, count(*)::int as bills, coalesce(sum(s.total), 0)::float as value
         from sale s where s.status = 'COMPLETE' and s.bill_date >= $1::date and s.bill_date < ($1::date + interval '1 month') group by 1`, [period + '-01']);
    return rows.map(d => {
      const t = sales.find((x: any) => x.uid === d.user_id);
      return {
        employee_id: d.employee_id, name: d.name, designation: d.designation, role: d.role_name,
        review_id: d.review?.id ?? null, scores: d.review?.scores ?? null, total_points: d.review?.total_points ?? null, max_points: d.review?.max_points ?? null,
        percent: d.review?.percent ?? null, band_label: d.review?.band_label ?? null, incentive_percent: d.review?.incentive_percent ?? null, note: d.review?.note ?? null,
        bills: t?.bills ?? 0, sales_value: t?.value ?? 0,
        items: d.items, pending: d.pending, draft: d.draft, finalised: d.finalised, locked: d.locked, payroll_locked: d.payroll_locked,
      };
    });
  }

  async score(b: any, by: any) {
    if (!PERIOD.test(b?.period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const [emp] = await this.manager.query(
      `select e.id, coalesce(e.full_name, u.full_name) as full_name, (select r.name from app_role r where r.id = u.role_id) as role_name
         from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id)]);
    if (!emp) throw new BadRequestException('Choose the staff member.');
    const [paid] = await this.manager.query(`select 1 from hr_payroll_run where period = $1 and status = 'APPROVED'`, [b.period]);
    if (paid) throw new BadRequestException('That month\'s payroll is approved; reopen it to change a score.');
    const metrics = await this.manager.query(`select id, name, max_points::float as max from hr_kpi_metric where active order by display_order, name`);
    if (!metrics.length) throw new BadRequestException('Set up the KPI measures first.');
    const given = new Map<number, number>((Array.isArray(b.scores) ? b.scores : []).map((s: any) => [Number(s.metric_id), Number(s.points)]));
    const scores = metrics.map((m: any) => {
      const p = given.get(m.id);
      if (p === undefined || !Number.isFinite(p) || p < 0 || p > m.max) throw new BadRequestException(`${m.name}: score between 0 and ${m.max}.`);
      return { metric_id: m.id, name: m.name, max: m.max, points: p };
    });
    const total = r1(scores.reduce((t: number, s: any) => t + s.points, 0));
    const max = r1(scores.reduce((t: number, s: any) => t + s.max, 0));
    const percent = r1(max > 0 ? total * 100 / max : 0);
    const [band] = await this.manager.query(
      `select label, incentive_percent::float as pct from hr_kpi_band
        where min_percent <= $1 and role_name is not distinct from (case when exists (select 1 from hr_kpi_band where role_name = $2) then $2 else null end)
        order by min_percent desc limit 1`, [percent, emp.role_name]);
    await this.manager.query(
      `insert into hr_kpi_review (employee_id, period, scores, total_points, max_points, percent, band_label, incentive_percent, note, scored_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (employee_id, period) do update set scores = excluded.scores, total_points = excluded.total_points, max_points = excluded.max_points, percent = excluded.percent,
         band_label = excluded.band_label, incentive_percent = excluded.incentive_percent, note = excluded.note, scored_by = excluded.scored_by, scored_on = now()`,
      [emp.id, b.period, JSON.stringify(scores), total, max, percent, band?.label ?? null, band?.pct ?? 0, String(b.note || '').trim().slice(0, 200) || null, by.id]);
    await this.audit.record({ userId: by.id, action: 'hr.kpi_scored', entityType: 'hr_kpi_review', entityId: emp.id, summary: `${emp.full_name} ${b.period}: KPI ${percent}% ${band?.label ?? ''}`, details: { total, max } });
    return { percent, band: band?.label ?? null, incentive_percent: band?.pct ?? 0 };
  }
}

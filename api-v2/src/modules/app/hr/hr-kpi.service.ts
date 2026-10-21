import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** KPI measures, bands (score % -> incentive % of the month's earnings) and the monthly scoring. */
@Injectable()
export class HrKpiService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  metrics() {
    return this.manager.query(`select id, name, description, max_points::float as max_points, display_order, active from hr_kpi_metric order by display_order, name`);
  }

  async saveMetric(id: number | null, b: any, by: any) {
    const name = String(b?.name || '').trim().slice(0, 60);
    if (!name) throw new BadRequestException('Give the measure a name.');
    const max = Number(b?.max_points);
    if (!Number.isFinite(max) || max <= 0 || max > 1000) throw new BadRequestException('Maximum points must be above 0.');
    const desc = String(b?.description || '').trim().slice(0, 200) || null;
    if (id) {
      const [cur] = await this.manager.query(`select 1 from hr_kpi_metric where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Measure not found.');
      await this.manager.query(`update hr_kpi_metric set name = $2, description = $3, max_points = $4, display_order = $5, active = $6 where id = $1`,
        [id, name, desc, max, Number(b.display_order) || 10, b.active !== false]);
    } else {
      const [r] = await this.manager.query(`insert into hr_kpi_metric (name, description, max_points, display_order) values ($1,$2,$3,$4) returning id`, [name, desc, max, Number(b.display_order) || 10]);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'hr.kpi_metric_saved', entityType: 'hr_kpi_metric', entityId: id, summary: `KPI measure ${name} (${max} points)`, details: {} });
    return { id };
  }

  bands() {
    return this.manager.query(`select id, min_percent::float as min_percent, label, incentive_percent::float as incentive_percent from hr_kpi_band order by min_percent desc`);
  }

  /** the whole band table is replaced in one go */
  async saveBands(b: any, by: any) {
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
      await tm.query(`delete from hr_kpi_band`);
      for (const x of rows) await tm.query(`insert into hr_kpi_band (min_percent, label, incentive_percent) values ($1,$2,$3)`, [Number(x.min_percent), String(x.label).trim().slice(0, 30), Number(x.incentive_percent)]);
    });
    await this.audit.record({ userId: by.id, action: 'hr.kpi_bands_saved', entityType: 'hr_kpi_band', entityId: null, summary: `KPI bands saved (${rows.length})`, details: { rows } });
    return { count: rows.length };
  }

  /** each person's score for the month (or null), with what the till shows for them as a reference */
  async month(period: string) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const start = period + '-01';
    return this.manager.query(
      `select e.id as employee_id, u.full_name as name, e.designation,
              k.id as review_id, k.scores, k.total_points::float as total_points, k.max_points::float as max_points, k.percent::float as percent, k.band_label, k.incentive_percent::float as incentive_percent, k.note,
              (select count(*) from sale s where coalesce(s.acting_user_id, s.created_by) = e.user_id and s.status = 'COMPLETE' and s.bill_date >= $1::date and s.bill_date < ($1::date + interval '1 month'))::int as bills,
              (select coalesce(sum(s.total), 0) from sale s where coalesce(s.acting_user_id, s.created_by) = e.user_id and s.status = 'COMPLETE' and s.bill_date >= $1::date and s.bill_date < ($1::date + interval '1 month'))::float as sales_value
         from hr_employee e left join app_user u on u.id = e.user_id
         left join hr_kpi_review k on k.employee_id = e.id and k.period = $2
        where e.join_date < ($1::date + interval '1 month') and (e.exit_date is null or e.exit_date >= $1::date)
        order by u.full_name`, [start, period]);
  }

  async score(b: any, by: any) {
    if (!PERIOD.test(b?.period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const [emp] = await this.manager.query(`select e.id, u.full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id)]);
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
    const [band] = await this.manager.query(`select label, incentive_percent::float as pct from hr_kpi_band where min_percent <= $1 order by min_percent desc limit 1`, [percent]);
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

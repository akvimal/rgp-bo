import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { HrPayrollService } from './hr-payroll.service';
import { BONUS_BASES, BONUS_KINDS, BonusBasis, bonusAmount, bonusSkipReason } from './hr-variable-pay';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const clean = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

/**
 * Bonuses for a pay month: a festival bonus to everyone who qualifies (a fixed amount, or a share of Basic or of the full salary),
 * or one bonus to one person. Payroll adds the month's bonuses to the pay; an approved month cannot be changed.
 */
@Injectable()
export class HrBonusService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly payroll: HrPayrollService) {}

  async list(period: string) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const items = await this.manager.query(
      `select b.id, b.employee_id, coalesce(e.full_name, u.full_name) as staff, e.emp_code, b.kind, b.name, b.amount::float as amount, b.basis, b.note
         from hr_bonus_item b join hr_employee e on e.id = b.employee_id left join app_user u on u.id = e.user_id
        where b.period = $1 order by b.name, coalesce(e.full_name, u.full_name)`, [period]);
    const [run] = await this.manager.query(`select status from hr_payroll_run where period = $1`, [period]);
    return { period, locked: run?.status === 'APPROVED', payroll: run?.status || null, total: Math.round(items.reduce((t: number, x: any) => t + x.amount, 0) * 100) / 100, items };
  }

  private parse(b: any) {
    const period = String(b?.period || '');
    if (!PERIOD.test(period)) throw new BadRequestException('Choose the pay month the bonus is paid in.');
    const name = clean(b?.name, 60);
    if (!name) throw new BadRequestException('Give the bonus a name, for example Diwali 2026.');
    const kind = String(b?.kind || 'FESTIVAL');
    if (!(BONUS_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('The bonus kind is not valid.');
    const basis = String(b?.basis || 'FIXED') as BonusBasis;
    if (!(BONUS_BASES as readonly string[]).includes(basis)) throw new BadRequestException('Work the bonus out as a fixed amount, a share of Basic, or a share of the full salary.');
    const value = Number(b?.value);
    if (!Number.isFinite(value) || value <= 0) throw new BadRequestException('Give the amount, or the percentage.');
    if (basis !== 'FIXED' && value > 500) throw new BadRequestException('A percentage over 500 is not likely. Check it.');
    if (basis === 'FIXED' && value > 10000000) throw new BadRequestException('That amount is too large.');
    const minMonths = b?.min_service_months === undefined || b?.min_service_months === '' ? 0 : Number(b.min_service_months);
    if (!Number.isInteger(minMonths) || minMonths < 0 || minMonths > 120) throw new BadRequestException('Minimum service is a whole number of months, 0 to 120.');
    const positionId = Number(b?.position_id) || null;
    return { period, name, kind, basis, value, minMonths, positionId };
  }

  /** who would get what; nothing is saved */
  async preview(b: any) {
    const p = this.parse(b);
    const dim = new Date(Date.UTC(Number(p.period.slice(0, 4)), Number(p.period.slice(5)), 0)).getUTCDate();
    const end = `${p.period}-${String(dim).padStart(2, '0')}`;
    const people = await this.manager.query(
      `select e.id, e.emp_code, coalesce(e.full_name, u.full_name) as name, to_char(e.join_date, 'YYYY-MM-DD') as join_date, to_char(e.exit_date, 'YYYY-MM-DD') as exit_date,
              exists (select 1 from hr_bonus_item x where x.employee_id = e.id and x.period = $1 and x.name = $2) as already
         from hr_employee e left join app_user u on u.id = e.user_id
        where e.on_payroll and ($3::int is null or e.position_id = $3) order by coalesce(e.full_name, u.full_name)`, [p.period, p.name, p.positionId]);
    const eligible: any[] = [];
    const skipped: any[] = [];
    for (const e of people) {
      const why = bonusSkipReason(e.join_date, e.exit_date, p.period, p.minMonths);
      if (why) { skipped.push({ employee_id: e.id, name: e.name, reason: why }); continue; }
      if (e.already) { skipped.push({ employee_id: e.id, name: e.name, reason: 'already has this bonus for the month' }); continue; }
      // payroll leaves out anyone with no salary in force, so a bonus to them would never be paid
      const lines = await this.manager.query(
        `select c.code, l.amount::float as amount from hr_salary_revision_line l join hr_pay_component c on c.id = l.component_id
          where c.kind = 'EARNING' and l.revision_id = (select id from hr_salary_revision where employee_id = $1 and effective_from <= $2::date order by effective_from desc limit 1)`, [e.id, end]);
      if (!lines.length) { skipped.push({ employee_id: e.id, name: e.name, reason: 'no salary is set' }); continue; }
      const basic = lines.filter((x: any) => x.code === 'BASIC').reduce((t: number, x: any) => t + x.amount, 0);
      const gross = lines.reduce((t: number, x: any) => t + x.amount, 0);
      const amount = bonusAmount(p.basis, p.value, basic, gross);
      if (amount <= 0) { skipped.push({ employee_id: e.id, name: e.name, reason: 'comes to nothing' }); continue; }
      eligible.push({ employee_id: e.id, emp_code: e.emp_code, name: e.name, amount });
    }
    const total = Math.round(eligible.reduce((t, x) => t + x.amount, 0) * 100) / 100;
    return { ...p, eligible, skipped, total };
  }

  /** gives the bonus to everyone the preview lists, less anyone left out and with any amount changed */
  async create(b: any, by: any) {
    const p = this.parse(b);
    await this.payroll.assertOpen(p.period);
    const pre = await this.preview(b);
    const exclude = new Set<number>((Array.isArray(b?.exclude) ? b.exclude : []).map(Number));
    const amounts: Record<string, any> = b?.amounts && typeof b.amounts === 'object' ? b.amounts : {};
    const rows = pre.eligible.filter((x: any) => !exclude.has(x.employee_id)).map((x: any) => {
      const given = amounts[x.employee_id];
      if (given === undefined || given === null || given === '') return x;
      const n = Math.round(Number(given) * 100) / 100;
      if (!Number.isFinite(n) || n <= 0) throw new BadRequestException(`${x.name}: the amount is not valid.`);
      return { ...x, amount: n };
    });
    if (!rows.length) throw new BadRequestException('No one qualifies for this bonus.');
    await this.manager.transaction(async tm => {
      for (const r of rows) {
        await tm.query(`insert into hr_bonus_item (employee_id, period, kind, name, amount, basis, created_by) values ($1,$2,$3,$4,$5,$6,$7)`,
          [r.employee_id, p.period, p.kind, p.name, r.amount, p.basis, by.id]);
      }
      await this.payroll.syncBonus(p.period, by, tm);
    });
    const total = Math.round(rows.reduce((t: number, x: any) => t + x.amount, 0) * 100) / 100;
    await this.audit.record({ userId: by.id, action: 'hr.bonus_given', entityType: 'hr_bonus_item', entityId: null, summary: `${p.name} (${p.kind.toLowerCase()}) for ${p.period}: ${rows.length} staff, ${total.toFixed(2)}`,
      details: { period: p.period, basis: p.basis, value: p.value, min_service_months: p.minMonths, staff: rows.length, total } });
    return { given: rows.length, total, skipped: pre.skipped };
  }

  /** one bonus to one person */
  async addOne(b: any, by: any) {
    const period = String(b?.period || '');
    if (!PERIOD.test(period)) throw new BadRequestException('Choose the pay month the bonus is paid in.');
    const name = clean(b?.name, 60);
    if (!name) throw new BadRequestException('Give the bonus a name.');
    const kind = String(b?.kind || 'PERFORMANCE');
    if (!(BONUS_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('The bonus kind is not valid.');
    const amount = Math.round(Number(b?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw new BadRequestException('Give the bonus amount.');
    const [emp] = await this.manager.query(`select e.id, coalesce(e.full_name, u.full_name) as name, e.on_payroll from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id) || 0]);
    if (!emp) throw new BadRequestException('Choose the staff member.');
    if (!emp.on_payroll) throw new BadRequestException(`${emp.name} is not paid through payroll.`);
    const dim = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)).getUTCDate();
    const [rev] = await this.manager.query(`select 1 from hr_salary_revision where employee_id = $1 and effective_from <= $2::date limit 1`, [emp.id, `${period}-${String(dim).padStart(2, '0')}`]);
    if (!rev) throw new BadRequestException(`${emp.name} has no salary set for ${period}, so payroll would not pay it.`);
    await this.payroll.assertOpen(period);
    const [dup] = await this.manager.query(`select 1 from hr_bonus_item where employee_id = $1 and period = $2 and name = $3`, [emp.id, period, name]);
    if (dup) throw new BadRequestException(`${emp.name} already has "${name}" for ${period}. Change that one instead.`);
    const row = await this.manager.transaction(async tm => {
      const [r] = await tm.query(
        `insert into hr_bonus_item (employee_id, period, kind, name, amount, basis, note, created_by) values ($1,$2,$3,$4,$5,'FIXED',$6,$7) returning id`,
        [emp.id, period, kind, name, amount, clean(b?.note, 200), by.id]);
      await this.payroll.syncBonus(period, by, tm);
      return r;
    });
    await this.audit.record({ userId: by.id, action: 'hr.bonus_given', entityType: 'hr_bonus_item', entityId: row.id, summary: `${name} for ${emp.name}, ${period}: ${amount.toFixed(2)}`, details: { kind } });
    return { id: row.id };
  }

  async update(id: number, b: any, by: any) {
    const [cur] = await this.manager.query(`select b.*, coalesce(e.full_name, u.full_name) as staff from hr_bonus_item b join hr_employee e on e.id = b.employee_id left join app_user u on u.id = e.user_id where b.id = $1`, [id]);
    if (!cur) throw new NotFoundException('Bonus not found.');
    await this.payroll.assertOpen(cur.period);
    const amount = b?.amount === undefined ? Number(cur.amount) : Math.round(Number(b.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw new BadRequestException('Give the bonus amount.');
    const note = b?.note === undefined ? cur.note : clean(b.note, 200);
    await this.manager.transaction(async tm => {
      await tm.query(`update hr_bonus_item set amount = $2, note = $3 where id = $1`, [id, amount, note]);
      await this.payroll.syncBonus(cur.period, by, tm);
    });
    await this.audit.record({ userId: by.id, action: 'hr.bonus_changed', entityType: 'hr_bonus_item', entityId: id, summary: `${cur.name} for ${cur.staff}, ${cur.period}: ${Number(cur.amount).toFixed(2)} to ${amount.toFixed(2)}`, details: {} });
    return { id };
  }

  async remove(id: number, by: any) {
    const [cur] = await this.manager.query(`select b.*, coalesce(e.full_name, u.full_name) as staff from hr_bonus_item b join hr_employee e on e.id = b.employee_id left join app_user u on u.id = e.user_id where b.id = $1`, [id]);
    if (!cur) throw new NotFoundException('Bonus not found.');
    await this.payroll.assertOpen(cur.period);
    await this.manager.transaction(async tm => {
      await tm.query(`delete from hr_bonus_item where id = $1`, [id]);
      await this.payroll.syncBonus(cur.period, by, tm);
    });
    await this.audit.record({ userId: by.id, action: 'hr.bonus_removed', entityType: 'hr_bonus_item', entityId: id, summary: `${cur.name} for ${cur.staff}, ${cur.period}, ${Number(cur.amount).toFixed(2)}, removed`, details: {} });
    return { removed: true };
  }
}

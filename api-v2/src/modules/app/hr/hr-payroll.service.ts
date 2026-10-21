import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AuditService } from 'src/core/audit/audit.service';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAY_DAYS = 30;                       // a fixed 30-day pay month
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: any) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

/**
 * Monthly payroll on a fixed 30-day month. Pay = the salary in force on the 1st (or the joining date) x payable days / 30.
 * Payable days = 30 - unpaid days (absent, unpaid leave, half days) - days before joining / after leaving.
 * Days nobody marked count as worked. Staff-credit balances are recovered in the run; approving it writes the recovery
 * entries, and reopening it takes them back.
 */
@Injectable()
export class HrPayrollService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  async runs() {
    return this.manager.query(
      `select r.id, r.period, r.status, r.total_earnings::float as total_earnings, r.total_deductions::float as total_deductions, r.total_net::float as total_net,
              r.approved_on, (select count(*) from hr_payroll_line l where l.run_id = r.id)::int as staff
         from hr_payroll_run r order by r.period desc limit 36`);
  }

  async get(period: string) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const [run] = await this.manager.query(`select r.*, a.full_name as approved_by_name from hr_payroll_run r left join app_user a on a.id = r.approved_by where r.period = $1`, [period]);
    if (!run) return null;
    const lines = await this.manager.query(
      `select l.id, l.employee_id, u.full_name as name, e.emp_code, e.designation, l.payable_days::float as payable_days, l.unpaid_days::float as unpaid_days, l.not_employed_days::float as not_employed_days,
              l.earnings, l.deductions, l.earnings_paid::float as earnings_paid, l.fixed_deductions::float as fixed_deductions, l.extra_deduction::float as extra_deduction,
              l.staff_credit_recovery::float as staff_credit_recovery, l.kpi_incentive::float as kpi_incentive, l.adjustment::float as adjustment, l.adjustment_note, l.net::float as net,
              coalesce((select sum(amount) from staff_credit_entry c where c.user_id = e.user_id), 0)::float as credit_outstanding
         from hr_payroll_line l join hr_employee e on e.id = l.employee_id left join app_user u on u.id = e.user_id
        where l.run_id = $1 order by u.full_name`, [run.id]);
    return { ...run, lines };
  }

  /** works out (or re-works) the draft; edits made to a draft's lines are reset */
  async generate(period: string, by: any) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const [existing] = await this.manager.query(`select id, status from hr_payroll_run where period = $1`, [period]);
    if (existing?.status === 'APPROVED') throw new BadRequestException('This month is approved. Reopen it to work it out again.');
    const start = period + '-01';
    const dim = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)).getUTCDate();
    const end = `${period}-${String(dim).padStart(2, '0')}`;

    const emps = await this.manager.query(
      `select e.id, e.user_id, to_char(e.join_date, 'YYYY-MM-DD') as join_date, to_char(e.exit_date, 'YYYY-MM-DD') as exit_date, u.full_name
         from hr_employee e left join app_user u on u.id = e.user_id
        where e.join_date <= $2::date and (e.exit_date is null or e.exit_date >= $1::date) order by u.full_name`, [start, end]);
    if (!emps.length) throw new BadRequestException('There is no staff employed in that month.');

    const warnings: string[] = [];
    const lines: any[] = [];
    for (const e of emps) {
      const ref = e.join_date > start ? e.join_date : start;
      const [rev] = await this.manager.query(`select id from hr_salary_revision where employee_id = $1 and effective_from <= $2::date order by effective_from desc limit 1`, [e.id, ref]);
      if (!rev) { warnings.push(`${e.full_name}: no salary is set for this month, so they are left out.`); continue; }
      const comp = await this.manager.query(
        `select c.code, c.name, c.kind, l.amount::float as amount from hr_salary_revision_line l join hr_pay_component c on c.id = l.component_id where l.revision_id = $1 order by c.display_order`, [rev.id]);

      // days
      const joinGap = e.join_date > start ? Number(e.join_date.slice(8)) - 1 : 0;
      const exitGap = e.exit_date && e.exit_date < end ? dim - Number(e.exit_date.slice(8)) : 0;
      const notEmployed = Math.min(PAY_DAYS, joinGap + exitGap);
      const first = e.join_date > start ? e.join_date : start;
      const last = e.exit_date && e.exit_date < end ? e.exit_date : end;
      const att = await this.manager.query(`select to_char(att_date, 'YYYY-MM-DD') as d, status from hr_attendance where employee_id = $1 and att_date between $2 and $3`, [e.id, first, last]);
      const lv = await this.manager.query(`select to_char(leave_date, 'YYYY-MM-DD') as d, paid, fraction::float as fraction from hr_leave_day where employee_id = $1 and leave_date between $2 and $3`, [e.id, first, last]);
      const leaveBy = new Map<string, any>(lv.map((x: any) => [x.d, x]));
      let unpaid = 0;
      const seen = new Set<string>();
      for (const l of lv) { seen.add(l.d); if (!l.paid) unpaid += l.fraction; }
      for (const a of att) {
        if (seen.has(a.d)) continue;                       // an approved leave decides that day
        if (a.status === 'ABSENT') unpaid += 1;
        else if (a.status === 'HALF_DAY') unpaid += 0.5;
      }
      void leaveBy;
      const payable = Math.max(0, PAY_DAYS - notEmployed - unpaid);

      const earnings = comp.filter((c: any) => c.kind === 'EARNING').map((c: any) => ({ code: c.code, name: c.name, full: c.amount, paid: r2(c.amount * payable / PAY_DAYS) }));
      const deductions = comp.filter((c: any) => c.kind === 'DEDUCTION').map((c: any) => ({ code: c.code, name: c.name, amount: c.amount }));
      const earningsPaid = r2(earnings.reduce((t: number, x: any) => t + x.paid, 0));
      const fixedDed = r2(deductions.reduce((t: number, x: any) => t + x.amount, 0));

      const [kpi] = await this.manager.query(`select incentive_percent::float as pct from hr_kpi_review where employee_id = $1 and period = $2`, [e.id, period]);
      const kpiIncentive = kpi ? r2(earningsPaid * kpi.pct / 100) : 0;

      let recovery = 0;
      if (e.user_id) {
        const [bal] = await this.manager.query(`select coalesce(sum(amount), 0)::float as b from staff_credit_entry where user_id = $1`, [e.user_id]);
        recovery = r2(Math.max(0, Math.min(bal.b, earningsPaid + kpiIncentive - fixedDed)));
      }
      lines.push({ e, payable, unpaid, notEmployed, earnings, deductions, earningsPaid, fixedDed, kpiIncentive, recovery,
        net: r2(earningsPaid + kpiIncentive - fixedDed - recovery) });
    }
    if (!lines.length) throw new BadRequestException('No one has a salary set for that month. ' + warnings.join(' '));

    const runId = await this.manager.transaction(async tm => {
      let id = existing?.id;
      if (!id) [{ id }] = await tm.query(`insert into hr_payroll_run (period, created_by) values ($1,$2) returning id`, [period, by.id]);
      await tm.query(`delete from hr_payroll_line where run_id = $1`, [id]);
      for (const l of lines) {
        await tm.query(
          `insert into hr_payroll_line (run_id, employee_id, payable_days, unpaid_days, not_employed_days, earnings, deductions, earnings_paid, fixed_deductions, staff_credit_recovery, kpi_incentive, net)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, l.e.id, l.payable, l.unpaid, l.notEmployed, JSON.stringify(l.earnings), JSON.stringify(l.deductions), l.earningsPaid, l.fixedDed, l.recovery, l.kpiIncentive, l.net]);
      }
      await this.totals(tm, id);
      return id;
    });
    await this.audit.record({ userId: by.id, action: 'hr.payroll_generated', entityType: 'hr_payroll_run', entityId: runId, summary: `Payroll ${period} worked out for ${lines.length} staff`, details: { warnings } });
    return { run: await this.get(period), warnings };
  }

  private async totals(tm: EntityManager, runId: number) {
    await tm.query(
      `update hr_payroll_run r set total_earnings = coalesce(t.e, 0), total_deductions = coalesce(t.d, 0), total_net = coalesce(t.n, 0)
         from (select sum(earnings_paid + kpi_incentive + adjustment) as e, sum(fixed_deductions + extra_deduction + staff_credit_recovery) as d, sum(net) as n
                 from hr_payroll_line where run_id = $1) t where r.id = $1`, [runId]);
  }

  async editLine(id: number, b: any, by: any) {
    const [l] = await this.manager.query(
      `select l.*, r.status, r.period, r.id as rid, e.user_id, u.full_name from hr_payroll_line l join hr_payroll_run r on r.id = l.run_id join hr_employee e on e.id = l.employee_id left join app_user u on u.id = e.user_id where l.id = $1`, [id]);
    if (!l) throw new NotFoundException('Payroll line not found.');
    if (l.status !== 'DRAFT') throw new BadRequestException('This month is approved and locked.');
    const num = (v: any, def: number, name: string, allowNeg = false) => {
      if (v === undefined) return def;
      const n = Number(v);
      if (!Number.isFinite(n) || (!allowNeg && n < 0)) throw new BadRequestException(`${name} is not a valid amount.`);
      return r2(n);
    };
    let unpaid = Number(l.unpaid_days);
    if (b.unpaid_days !== undefined) {
      unpaid = Number(b.unpaid_days);
      if (!Number.isFinite(unpaid) || unpaid < 0 || unpaid > PAY_DAYS || Math.round(unpaid * 2) !== unpaid * 2) throw new BadRequestException('Unpaid days must be between 0 and 30, in halves.');
    }
    const payable = Math.max(0, PAY_DAYS - Number(l.not_employed_days) - unpaid);
    const earnings = (l.earnings as any[]).map(x => ({ ...x, paid: r2(x.full * payable / PAY_DAYS) }));
    const earningsPaid = r2(earnings.reduce((t, x) => t + x.paid, 0));
    const extra = num(b.extra_deduction, Number(l.extra_deduction), 'The extra deduction');
    const kpi = num(b.kpi_incentive, Number(l.kpi_incentive), 'The incentive');
    const adj = num(b.adjustment, Number(l.adjustment), 'The adjustment', true);
    const note = b.adjustment_note !== undefined ? (String(b.adjustment_note || '').trim().slice(0, 200) || null) : l.adjustment_note;
    if (adj !== 0 && !note) throw new BadRequestException('Say what the adjustment is for.');
    let recovery = num(b.staff_credit_recovery, Number(l.staff_credit_recovery), 'The staff-credit recovery');
    if (recovery > 0) {
      const [bal] = await this.manager.query(`select coalesce(sum(amount), 0)::float as b from staff_credit_entry where user_id = $1`, [l.user_id || 0]);
      if (recovery > bal.b + 0.005) throw new BadRequestException(`${l.full_name} owes ${bal.b.toFixed(2)} on staff credit; more than that cannot be recovered.`);
    }
    const net = r2(earningsPaid + kpi + adj - Number(l.fixed_deductions) - extra - recovery);
    if (net < 0) throw new BadRequestException(`Net pay would be ${net.toFixed(2)}. Lower the deductions or recovery.`);
    await this.manager.transaction(async tm => {
      await tm.query(
        `update hr_payroll_line set unpaid_days = $2, payable_days = $3, earnings = $4, earnings_paid = $5, extra_deduction = $6, kpi_incentive = $7, adjustment = $8, adjustment_note = $9, staff_credit_recovery = $10, net = $11 where id = $1`,
        [id, unpaid, payable, JSON.stringify(earnings), earningsPaid, extra, kpi, adj, note, recovery, net]);
      await this.totals(tm, l.rid);
    });
    await this.audit.record({ userId: by.id, action: 'hr.payroll_line_edited', entityType: 'hr_payroll_line', entityId: id, summary: `${l.full_name} ${l.period}: payroll line edited, net ${net.toFixed(2)}`, details: b });
    return { id, net };
  }

  async approve(period: string, by: any) {
    const run = await this.get(period);
    if (!run) throw new NotFoundException('Work out the month first.');
    if (run.status === 'APPROVED') throw new BadRequestException('Already approved.');
    if (!run.lines.length) throw new BadRequestException('The run has no staff.');
    await this.manager.transaction(async tm => {
      for (const l of run.lines) {
        if (l.staff_credit_recovery > 0) {
          const [emp] = await tm.query(`select user_id from hr_employee where id = $1`, [l.employee_id]);
          const [bal] = await tm.query(`select coalesce(sum(amount), 0)::float as b from staff_credit_entry where user_id = $1`, [emp.user_id || 0]);
          if (l.staff_credit_recovery > bal.b + 0.005) throw new BadRequestException(`${l.name}'s staff-credit balance changed to ${bal.b.toFixed(2)}; work the month out again.`);
          await tm.query(`insert into staff_credit_entry (user_id, kind, amount, period, note, created_by) values ($1,'RECOVERY',$2,$3,$4,$5)`,
            [emp.user_id, -l.staff_credit_recovery, period, `Payroll ${period}`, by.id]);
        }
      }
      await tm.query(`update hr_payroll_run set status = 'APPROVED', approved_by = $2, approved_on = now() where id = $1`, [run.id, by.id]);
    });
    await this.audit.record({ userId: by.id, action: 'hr.payroll_approved', entityType: 'hr_payroll_run', entityId: run.id, summary: `Payroll ${period} approved, net ${Number(run.total_net).toFixed(2)}`, details: {} });
    return this.get(period);
  }

  /** takes an approved month back to draft: the staff-credit recoveries it wrote are removed */
  async reopen(period: string, b: any, by: any) {
    const run = await this.get(period);
    if (!run) throw new NotFoundException('No payroll for that month.');
    if (run.status !== 'APPROVED') throw new BadRequestException('The month is not approved.');
    const reason = String(b?.reason || '').trim();
    if (reason.length < 5) throw new BadRequestException('Say why it is reopened: at least 5 characters.');
    await this.manager.transaction(async tm => {
      await tm.query(`delete from staff_credit_entry where kind = 'RECOVERY' and period = $1 and note = $2`, [period, `Payroll ${period}`]);
      await tm.query(`update hr_payroll_run set status = 'DRAFT', approved_by = null, approved_on = null where id = $1`, [run.id]);
    });
    await this.audit.record({ userId: by.id, action: 'hr.payroll_reopened', entityType: 'hr_payroll_run', entityId: run.id, summary: `Payroll ${period} reopened: ${reason}`, details: { reason } });
    return this.get(period);
  }

  /** everything a pay stub shows */
  async stub(lineId: number) {
    const [l] = await this.manager.query(
      `select l.id, r.period, r.status, e.emp_code, e.designation, e.pan, e.bank_name, e.account_no, e.ifsc, to_char(e.join_date, 'DD Mon YYYY') as join_date, u.full_name as name,
              l.payable_days::float as payable_days, l.unpaid_days::float as unpaid_days, l.not_employed_days::float as not_employed_days, l.earnings, l.deductions,
              l.earnings_paid::float as earnings_paid, l.fixed_deductions::float as fixed_deductions, l.extra_deduction::float as extra_deduction, l.staff_credit_recovery::float as staff_credit_recovery,
              l.kpi_incentive::float as kpi_incentive, l.adjustment::float as adjustment, l.adjustment_note, l.net::float as net
         from hr_payroll_line l join hr_payroll_run r on r.id = l.run_id join hr_employee e on e.id = l.employee_id left join app_user u on u.id = e.user_id where l.id = $1`, [lineId]);
    if (!l) throw new NotFoundException('Pay stub not found.');
    const [biz] = await this.manager.query(`select coalesce(legal_name, name) as name, address, gstin from business order by id limit 1`);
    const acct = l.account_no ? 'XXXX' + String(l.account_no).slice(-4) : null;
    return { ...l, account_no: acct, business: biz || {} };
  }

  async exportXlsx(period: string) {
    const run = await this.get(period);
    if (!run) throw new NotFoundException('No payroll for that month.');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Payroll ${period}`);
    const rows = await this.manager.query(
      `select l.id, e.emp_code, u.full_name as name, e.bank_name, e.account_no, e.ifsc from hr_payroll_line l join hr_employee e on e.id = l.employee_id left join app_user u on u.id = e.user_id where l.run_id = $1`, [run.id]);
    const bank = new Map<number, any>(rows.map((r: any) => [r.id, r]));
    ws.columns = [
      { header: 'Code', key: 'code', width: 9 }, { header: 'Name', key: 'name', width: 24 }, { header: 'Payable days', key: 'days', width: 13 },
      { header: 'Earnings', key: 'earn', width: 13 }, { header: 'Incentive', key: 'kpi', width: 12 }, { header: 'Adjustment', key: 'adj', width: 12 },
      { header: 'Fixed deductions', key: 'fixed', width: 16 }, { header: 'Other deduction', key: 'extra', width: 15 }, { header: 'Staff credit recovered', key: 'sc', width: 20 },
      { header: 'Net pay', key: 'net', width: 13 }, { header: 'Bank', key: 'bank', width: 20 }, { header: 'Account', key: 'acct', width: 20 }, { header: 'IFSC', key: 'ifsc', width: 14 },
    ];
    for (const l of run.lines) {
      const b = bank.get(l.id) || {};
      ws.addRow({ code: l.emp_code, name: l.name, days: l.payable_days, earn: l.earnings_paid, kpi: l.kpi_incentive, adj: l.adjustment, fixed: l.fixed_deductions, extra: l.extra_deduction, sc: l.staff_credit_recovery, net: l.net, bank: b.bank_name, acct: b.account_no, ifsc: b.ifsc });
    }
    ws.addRow({ name: 'Total', net: run.lines.reduce((t: number, l: any) => t + l.net, 0) }).font = { bold: true };
    ws.getRow(1).font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

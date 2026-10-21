import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Staff credit: what each person took on credit, what was taken from their salary, and the balance. Salary is worked
 * out in Excel outside the app, so the Business Head records each recovery here after the deduction is made.
 */
@Injectable()
export class StaffCreditService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  async assertBusinessHead(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (r?.name !== 'Business Head') throw new ForbiddenException('Only the Business Head manages staff credit.');
  }

  /** who the counter can put a bill on: people with a limit, and how much of it is left this month */
  async options() {
    const period = new Date().toISOString().slice(0, 7);
    return this.manager.query(
      `select u.id, u.full_name as name, l.monthly_cap::float as cap,
              greatest(l.monthly_cap - coalesce((select sum(amount) from staff_credit_entry e where e.user_id = u.id and e.period = $1 and e.kind = 'CREDIT'), 0), 0)::float as remaining
         from staff_credit_limit l join app_user u on u.id = l.user_id
        where u.active and l.monthly_cap > 0 order by u.full_name`, [period]);
  }

  /** every active person: cap, this month's credit and recoveries, and the balance still to recover */
  async summary(period: string) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    return this.manager.query(
      `select u.id as user_id, u.full_name as name, u.email, r.name as role,
              coalesce(l.monthly_cap, 0)::float as cap,
              coalesce(sum(e.amount) filter (where e.period = $1 and e.kind = 'CREDIT'), 0)::float as credit_month,
              coalesce(-sum(e.amount) filter (where e.period = $1 and e.kind = 'RECOVERY'), 0)::float as recovered_month,
              coalesce(sum(e.amount), 0)::float as outstanding
         from app_user u
         left join app_role r on r.id = u.role_id
         left join staff_credit_limit l on l.user_id = u.id
         left join staff_credit_entry e on e.user_id = u.id
        where u.active
        group by u.id, u.full_name, u.email, r.name, l.monthly_cap
        order by (coalesce(sum(e.amount), 0) <> 0) desc, coalesce(l.monthly_cap, 0) desc, u.full_name`, [period]);
  }

  async entries(userId: number) {
    const [u] = await this.manager.query(`select id, full_name as name from app_user where id = $1`, [userId]);
    if (!u) throw new NotFoundException('Staff member not found.');
    const rows = await this.manager.query(
      `select e.id, e.entry_date, e.kind, e.amount::float as amount, e.period, e.sale_id, e.note, b.full_name as by_name
         from staff_credit_entry e left join app_user b on b.id = e.created_by
        where e.user_id = $1 order by e.created_on desc, e.id desc limit 200`, [userId]);
    return { user: u, rows };
  }

  async setCap(userId: number, cap: any, by: any) {
    const amount = Number(cap);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) throw new BadRequestException('The monthly limit must be between 0 and 10,00,000.');
    const [u] = await this.manager.query(`select id, full_name from app_user where id = $1 and active`, [userId]);
    if (!u) throw new NotFoundException('Staff member not found.');
    const [before] = await this.manager.query(`select monthly_cap::float as cap from staff_credit_limit where user_id = $1`, [userId]);
    await this.manager.query(
      `insert into staff_credit_limit (user_id, monthly_cap, set_by, set_on) values ($1, $2, $3, now())
       on conflict (user_id) do update set monthly_cap = excluded.monthly_cap, set_by = excluded.set_by, set_on = now()`, [userId, amount, by.id]);
    await this.audit.record({ userId: by.id, action: 'staffcredit.cap_set', entityType: 'staffcredit', entityId: userId,
      summary: `${u.full_name}: monthly staff-credit limit ${before?.cap ?? 0} -> ${amount}`, details: { from: before?.cap ?? 0, to: amount } });
    return { userid: userId, cap: amount };
  }

  /** the Business Head records what was taken from the salary (done in Excel) so the balance comes down */
  async recover(userId: number, body: { amount: any; period: string; note?: string }, by: any) {
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    if (!(amount > 0)) throw new BadRequestException('Enter the amount recovered from the salary.');
    if (!PERIOD.test(body?.period || '')) throw new BadRequestException('Give the salary month (YYYY-MM).');
    const [u] = await this.manager.query(`select id, full_name from app_user where id = $1`, [userId]);
    if (!u) throw new NotFoundException('Staff member not found.');
    const [bal] = await this.manager.query(`select coalesce(sum(amount), 0)::float as balance from staff_credit_entry where user_id = $1`, [userId]);
    if (amount > Number(bal.balance) + 0.005) throw new BadRequestException(`${u.full_name} owes ${Number(bal.balance).toFixed(2)}; more than that cannot be recovered.`);
    await this.manager.query(
      `insert into staff_credit_entry (user_id, kind, amount, period, note, created_by) values ($1, 'RECOVERY', $2, $3, $4, $5)`,
      [userId, -amount, body.period, (body.note || `Salary ${body.period}`).slice(0, 200), by.id]);
    await this.audit.record({ userId: by.id, action: 'staffcredit.recovered', entityType: 'staffcredit', entityId: userId,
      summary: `${u.full_name}: ${amount} recovered from salary ${body.period}`, details: { amount, period: body.period } });
    return { balance: Math.round((Number(bal.balance) - amount) * 100) / 100 };
  }

  /** a correction, up or down, with a reason (a returned item, a mistaken bill) */
  async adjust(userId: number, body: { amount: any; note: string; period?: string }, by: any) {
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('Enter the amount to add (positive) or take off (negative).');
    const note = String(body?.note || '').trim();
    if (note.length < 5) throw new BadRequestException('Say why: at least 5 characters.');
    const period = body?.period && PERIOD.test(body.period) ? body.period : new Date().toISOString().slice(0, 7);
    const [u] = await this.manager.query(`select id, full_name from app_user where id = $1`, [userId]);
    if (!u) throw new NotFoundException('Staff member not found.');
    await this.manager.query(
      `insert into staff_credit_entry (user_id, kind, amount, period, note, created_by) values ($1, 'ADJUSTMENT', $2, $3, $4, $5)`,
      [userId, amount, period, note.slice(0, 200), by.id]);
    await this.audit.record({ userId: by.id, action: 'staffcredit.adjusted', entityType: 'staffcredit', entityId: userId,
      summary: `${u.full_name}: adjustment ${amount} (${note})`, details: { amount, note, period } });
    return { ok: true };
  }
}

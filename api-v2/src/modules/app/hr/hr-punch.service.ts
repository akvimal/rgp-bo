import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve, sep } from 'path';
import { AuditService } from 'src/core/audit/audit.service';
import { DeviceService } from 'src/modules/auth/device.service';
import { isOwnerRole } from 'src/core/roles';
import { uploadedFilePath } from '../files/upload-path';
import { datesBetween, decodePhoto, DOUBLE_TAP_SECONDS, generatePin, isValidPin, lockMinutesLeft, nextKind, PIN_FAILS_ALLOWED, PIN_LOCK_MINUTES, punchFlags, PunchKind } from './hr-punch';

const TZ = 'Asia/Kolkata';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY'];
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const TODAY_SQL = `to_char((now() at time zone '${TZ}')::date, 'YYYY-MM-DD')`;
const isOffDay = (d: string, emp: { weekly_off: string; work_days?: string[] | null }) => {
  const day = DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()];
  return emp.work_days?.length ? !emp.work_days.includes(day) : day === emp.weekly_off;
};

const uploadRoot = () => resolve(process.env.FILEUPLOAD_LOCATION || './upload');

/** the punch screen on a registered store PC: staff pick their name, enter a PIN, and a photo is taken */
@Injectable()
export class PunchService {
  private readonly log = new Logger('Punch');
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly devices: DeviceService) {}

  private async setting(key: string, fallback: number): Promise<number> {
    const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive`, [key]);
    const n = Number(r?.setting_value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  private async device(token: string | undefined, ip?: string) {
    const d = await this.devices.resolve(token, ip);
    if (!d) throw new ForbiddenException('Attendance can only be marked on a registered store PC.');
    return d;
  }

  /** employees of the PC's store who punch: SQL fragment on alias e, args pushed */
  private storeFilter(storeId: number, args: any[]): string {
    args.push(storeId);
    const p = `$${args.length}`;
    return `e.punch_enabled and e.status = 'ACTIVE' and (e.exit_date is null or e.exit_date >= (now() at time zone '${TZ}')::date)
            and (e.store_id = ${p} or exists (select 1 from user_stores us where us.user_id = e.user_id and us.active and not us.archive and us.store_id = ${p}))`;
  }

  async staff(token: string | undefined, ip?: string) {
    const dev = await this.device(token, ip);
    const args: any[] = [];
    const where = this.storeFilter(dev.storeid, args);
    const rows = await this.manager.query(
      `select e.id, coalesce(e.full_name, u.full_name) as name,
              (select p.kind from hr_punch p where p.employee_id = e.id and to_char(p.att_date, 'YYYY-MM-DD') = ${TODAY_SQL} order by p.punched_at desc limit 1) as last_kind,
              (select to_char(p.punched_at at time zone '${TZ}', 'HH24:MI') from hr_punch p where p.employee_id = e.id and p.kind = 'IN' and to_char(p.att_date, 'YYYY-MM-DD') = ${TODAY_SQL} order by p.punched_at limit 1) as in_time,
              (select to_char(p.punched_at at time zone '${TZ}', 'HH24:MI') from hr_punch p where p.employee_id = e.id and p.kind = 'OUT' and to_char(p.att_date, 'YYYY-MM-DD') = ${TODAY_SQL} order by p.punched_at desc limit 1) as out_time
         from hr_employee e left join app_user u on u.id = e.user_id
        where ${where} order by coalesce(e.full_name, u.full_name)`, args);
    return { device: dev.name, staff: rows.map((r: any) => ({ id: r.id, name: r.name, state: !r.last_kind ? 'NONE' : r.last_kind === 'IN' ? 'IN' : 'DONE', in_time: r.in_time, out_time: r.out_time })) };
  }

  async punch(b: any, token: string | undefined, ip?: string) {
    const dev = await this.device(token, ip);
    const photo = decodePhoto(b?.photo);
    if (!photo.ok) throw new BadRequestException(photo.reason);
    if (!isValidPin(b?.pin)) throw new BadRequestException('Enter your PIN (4 to 6 digits).');
    const args: any[] = [Number(b?.employee_id) || 0];
    const where = this.storeFilter(dev.storeid, args);
    const [emp] = await this.manager.query(
      `select e.id, e.store_id, e.punch_pin_hash, e.punch_fails, e.punch_locked_until, coalesce(e.full_name, u.full_name) as name,
              to_char(e.work_start, 'HH24:MI') as work_start, to_char(e.work_end, 'HH24:MI') as work_end
         from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1 and ${where}`, args);
    if (!emp || !emp.punch_pin_hash) throw new BadRequestException('Choose your name from the list.');
    const left = lockMinutesLeft(emp.punch_locked_until);
    if (left) throw new BadRequestException(`Too many wrong PINs. Try again in ${left} minute${left === 1 ? '' : 's'}, or ask your manager to reset it.`);
    if (!(await bcrypt.compare(String(b.pin), emp.punch_pin_hash))) {
      const fails = emp.punch_fails + 1;
      if (fails >= PIN_FAILS_ALLOWED) {
        await this.manager.query(`update hr_employee set punch_fails = 0, punch_locked_until = now() + ($2 || ' minutes')::interval where id = $1`, [emp.id, String(PIN_LOCK_MINUTES)]);
        throw new BadRequestException(`Wrong PIN. Locked for ${PIN_LOCK_MINUTES} minutes.`);
      }
      await this.manager.query(`update hr_employee set punch_fails = $2 where id = $1`, [emp.id, fails]);
      throw new BadRequestException(`Wrong PIN. ${PIN_FAILS_ALLOWED - fails} ${PIN_FAILS_ALLOWED - fails === 1 ? 'try' : 'tries'} left.`);
    }
    if (emp.punch_fails || emp.punch_locked_until) await this.manager.query(`update hr_employee set punch_fails = 0, punch_locked_until = null where id = $1`, [emp.id]);

    const [last] = await this.manager.query(
      `select kind, extract(epoch from (now() - punched_at))::float as age from hr_punch where employee_id = $1 and to_char(att_date, 'YYYY-MM-DD') = ${TODAY_SQL} order by punched_at desc limit 1`, [emp.id]);
    if (last && last.age < DOUBLE_TAP_SECONDS) throw new BadRequestException('Already recorded a moment ago.');
    const kind = nextKind(last?.kind as PunchKind | undefined);
    if (!kind) throw new BadRequestException('You have already marked In and Out today. If that is wrong, tell your manager.');

    const [now] = await this.manager.query(`select ${TODAY_SQL} as today, to_char(now() at time zone '${TZ}', 'HH24:MI') as hhmm, to_char(now() at time zone '${TZ}', 'YYYY-MM') as month`);
    const grace = await this.setting('attendance_grace_minutes', 10);
    const flags = punchFlags(kind, now.hhmm, emp.work_start, emp.work_end, grace);

    const dir = join('attendance', now.month);
    const rel = join(dir, `${emp.id}-${Date.now()}-${kind}.jpg`);
    const full = join(uploadRoot(), rel);
    mkdirSync(join(uploadRoot(), dir), { recursive: true });
    writeFileSync(full, photo.bytes);
    const stored = join(process.env.FILEUPLOAD_LOCATION || './upload', rel);

    try {
      await this.manager.transaction(async tm => {
        const [p] = await tm.query(
          `insert into hr_punch (employee_id, store_id, device_id, kind, att_date, photo_path, flags) values ($1, $2, $3, $4, $5::date, $6, $7) returning punched_at`,
          [emp.id, dev.storeid, dev.id, kind, now.today, stored, flags]);
        const [locked] = await tm.query(`select 1 as x from hr_payroll_run where period = $1 and status = 'APPROVED'`, [now.today.slice(0, 7)]);
        if (locked) return;                             // the month is approved: the punch is kept, the attendance is not rewritten
        if (kind === 'IN') {
          await tm.query(
            `insert into hr_attendance (employee_id, att_date, status, check_in, store_id, source, photo_path, verification_status, flags, created_by)
             values ($1, $2::date, 'PRESENT', $3, $4, 'KIOSK', $5, 'PENDING', $6, null)
             on conflict (employee_id, att_date) do update set status = 'PRESENT', check_in = coalesce(hr_attendance.check_in, excluded.check_in), store_id = excluded.store_id, source = 'KIOSK',
               photo_path = excluded.photo_path, verification_status = 'PENDING', flags = excluded.flags`,
            [emp.id, now.today, p.punched_at, dev.storeid, stored, flags]);
        } else {
          const [inn] = await tm.query(`select punched_at from hr_punch where employee_id = $1 and att_date = $2::date and kind = 'IN' order by punched_at limit 1`, [emp.id, now.today]);
          await tm.query(
            `insert into hr_attendance (employee_id, att_date, status, check_in, check_out, store_id, source, verification_status, flags)
             values ($1, $2::date, 'PRESENT', $3, $4, $5, 'KIOSK', 'PENDING', $6)
             on conflict (employee_id, att_date) do update set check_out = excluded.check_out, verification_status = 'PENDING',
               flags = (select coalesce(array_agg(distinct f), '{}') from unnest(hr_attendance.flags || excluded.flags) f)`,
            [emp.id, now.today, inn?.punched_at ?? null, p.punched_at, dev.storeid, flags]);
        }
      });
    } catch (e) {
      try { unlinkSync(full); } catch { /* nothing to remove */ }
      throw e;
    }
    return { kind, name: emp.name, time: now.hhmm, flags };
  }

  /** photos are personal data: kept for the retention days only; the time of the punch stays */
  @Cron('30 3 * * *', { timeZone: TZ })
  async removeOldPhotos() {
    try { await this.purgePhotos(); } catch (e: any) { this.log.error(`photo clean-up failed: ${e?.message}`); }
  }

  async purgePhotos(): Promise<number> {
    const days = Math.max(1, await this.setting('attendance_photo_days', 60));
    const old = await this.manager.query(
      `select id, photo_path from hr_punch where photo_path is not null and punched_at < now() - ($1 || ' days')::interval limit 2000`, [String(days)]);
    for (const p of old) {
      try {
        const target = resolve(p.photo_path);
        if (target.startsWith(uploadRoot() + sep) && existsSync(target)) unlinkSync(target);
      } catch { /* a file that is already gone is fine */ }
    }
    if (old.length) {
      await this.manager.query(`update hr_punch set photo_path = null where id = any($1::int[])`, [old.map((p: any) => p.id)]);
      await this.manager.query(`update hr_attendance set photo_path = null where att_date < ((now() at time zone '${TZ}')::date - $1::int)`, [days]);
    }
    return old.length;
  }
}

/** the manager's side: each day's punches and photos, corrections, PINs; and the count that holds payroll back */
@Injectable()
export class AttendanceReviewService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async ctx(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { id: user.id, all: isOwnerRole(r?.name), stores: s.map((x: any) => x.store_id) as number[] };
  }

  /** people (alias e) this reviewer answers for, and never themselves */
  private scope(c: { id: number; all: boolean; stores: number[] }, args: any[]): string {
    args.push(c.id);
    const notMe = `e.user_id is distinct from $${args.length}`;
    if (c.all) return notMe;
    args.push(c.stores.length ? c.stores : [0]);
    const st = `$${args.length}`;
    return `${notMe} and (e.store_id = any(${st}::int[]) or exists (select 1 from user_stores us where us.user_id = e.user_id and us.active and not us.archive and us.store_id = any(${st}::int[])))`;
  }

  private async today(): Promise<string> {
    const [r] = await this.manager.query(`select ${TODAY_SQL} as d`);
    return r.d;
  }

  /** the day-by-day picture of people who punch: pending reviews, days with no punch, done days */
  private async compute(from: string, to: string, extraWhere = 'true', args: any[] = []) {
    const today = await this.today();
    const emps = await this.manager.query(
      `select e.id, coalesce(e.full_name, u.full_name) as name, e.designation, e.weekly_off, e.work_days, e.store_id, (select s.location from stores s where s.id = e.store_id) as store,
              to_char(e.join_date, 'YYYY-MM-DD') as join_date, to_char(e.exit_date, 'YYYY-MM-DD') as exit_date
         from hr_employee e left join app_user u on u.id = e.user_id
        where e.punch_enabled and e.join_date <= $${args.length + 2}::date and (e.exit_date is null or e.exit_date >= $${args.length + 1}::date) and ${extraWhere}
        order by coalesce(e.full_name, u.full_name)`, [...args, from, to]);
    if (!emps.length) return { today, items: [] as any[] };
    const ids = emps.map((e: any) => e.id);
    const rows = await this.manager.query(
      `select employee_id, to_char(att_date, 'YYYY-MM-DD') as d, status, verification_status, flags, note, source,
              to_char(check_in at time zone '${TZ}', 'HH24:MI') as check_in, to_char(check_out at time zone '${TZ}', 'HH24:MI') as check_out
         from hr_attendance where employee_id = any($1::int[]) and att_date between $2::date and $3::date`, [ids, from, to]);
    const punches = await this.manager.query(
      `select id, employee_id, to_char(att_date, 'YYYY-MM-DD') as d, kind, to_char(punched_at at time zone '${TZ}', 'HH24:MI') as t, flags, (photo_path is not null) as has_photo
         from hr_punch where employee_id = any($1::int[]) and att_date between $2::date and $3::date order by punched_at`, [ids, from, to]);
    const leave = await this.manager.query(`select employee_id, to_char(leave_date, 'YYYY-MM-DD') as d from hr_leave_day where employee_id = any($1::int[]) and leave_date between $2::date and $3::date`, [ids, from, to]);
    const hol = new Set((await this.manager.query(`select to_char(holiday_date, 'YYYY-MM-DD') as d from hr_holiday where holiday_date between $1::date and $2::date`, [from, to])).map((h: any) => h.d));
    const onLeave = new Set(leave.map((l: any) => `${l.employee_id}|${l.d}`));
    const items: any[] = [];
    for (const e of emps) {
      const first = from > e.join_date ? from : e.join_date;
      const last = [to, today, e.exit_date].filter(Boolean).sort()[0] as string;
      for (const d of datesBetween(first, last)) {
        const row = rows.find((r: any) => r.employee_id === e.id && r.d === d);
        const base = { employee_id: e.id, name: e.name, designation: e.designation, store: e.store, date: d };
        if (row) {
          const type = row.verification_status === 'PENDING' ? (d < today ? 'PENDING' : 'TODAY') : 'DONE';
          items.push({ ...base, type, status: row.status, verification: row.verification_status, check_in: row.check_in, check_out: row.check_out, flags: row.flags || [], note: row.note, source: row.source,
            punches: punches.filter((p: any) => p.employee_id === e.id && p.d === d).map((p: any) => ({ id: p.id, kind: p.kind, time: p.t, flags: p.flags, photo: p.has_photo })) });
        } else if (d < today && !hol.has(d) && !isOffDay(d, e) && !onLeave.has(`${e.id}|${d}`)) {
          items.push({ ...base, type: 'MISSING', status: null, verification: null, check_in: null, check_out: null, flags: [], note: null, source: null, punches: [] });
        }
      }
    }
    return { today, items };
  }

  async list(q: any, user: any) {
    const c = await this.ctx(user);
    const month = /^\d{4}-\d{2}$/.test(q?.period || '') ? q.period : (await this.today()).slice(0, 7);
    const from = month + '-01';
    const to = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).toISOString().slice(0, 10);
    const args: any[] = [];
    let where = this.scope(c, args);
    const store = Number(q?.store);
    if (store) { args.push(store); where += ` and e.store_id = $${args.length}`; }
    const { items } = await this.compute(from, to, where, args);
    const all = String(q?.status || 'pending') === 'all';
    const shown = (all ? items : items.filter(i => i.type === 'PENDING' || i.type === 'MISSING')).sort((a, b) => (b.date + a.name).localeCompare(a.date + b.name));
    const todo = items.filter(i => i.type === 'PENDING' || i.type === 'MISSING');
    return { period: month, pending: todo.filter(i => i.type === 'PENDING').length, missing: todo.filter(i => i.type === 'MISSING').length, items: shown.slice(0, 400) };
  }

  /** days of a month (before today) that wait for a review: they hold payroll back */
  async unresolved(period: string): Promise<number> {
    const to = new Date(Date.UTC(+period.slice(0, 4), +period.slice(5), 0)).toISOString().slice(0, 10);
    const { items } = await this.compute(period + '-01', to);
    return items.filter(i => i.type === 'PENDING' || i.type === 'MISSING').length;
  }

  private async person(c: any, id: number) {
    const args: any[] = [id];
    const [e] = await this.manager.query(
      `select e.id, e.punch_enabled, coalesce(e.full_name, u.full_name) as name, to_char(e.join_date, 'YYYY-MM-DD') as join_date, to_char(e.exit_date, 'YYYY-MM-DD') as exit_date
         from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1 and ${this.scope(c, args)}`, args);
    if (!e) throw new NotFoundException('That staff member is not in your stores.');
    return e;
  }

  async resolveDay(b: any, user: any) {
    const c = await this.ctx(user);
    const e = await this.person(c, Number(b?.employee_id));
    const date = String(b?.date || '');
    if (!DATE.test(date)) throw new BadRequestException('Give the date.');
    if (date > (await this.today())) throw new BadRequestException('A future day cannot be reviewed.');
    if (date < e.join_date || (e.exit_date && date > e.exit_date)) throw new BadRequestException('That date is outside their employment.');
    const [run] = await this.manager.query(`select 1 as x from hr_payroll_run where period = $1 and status = 'APPROVED'`, [date.slice(0, 7)]);
    if (run) throw new BadRequestException('That month\'s payroll is approved; reopen it to change attendance.');
    const note = String(b?.note || '').trim().slice(0, 200);
    const tin = b?.check_in ? String(b.check_in) : null, tout = b?.check_out ? String(b.check_out) : null;
    if ((tin && !TIME.test(tin)) || (tout && !TIME.test(tout))) throw new BadRequestException('Give times as HH:MM, e.g. 09:05.');
    if (tin && tout && tout <= tin) throw new BadRequestException('Out must be after In.');
    const ts = (t: string | null) => (t ? `${date} ${t}:00` : null);
    const [row] = await this.manager.query(`select status, check_out, verification_status from hr_attendance where employee_id = $1 and att_date = $2::date`, [e.id, date]);
    const action = String(b?.action || '').toUpperCase();

    if (action === 'APPROVE') {
      if (!row || row.verification_status !== 'PENDING') throw new BadRequestException('There is nothing waiting for review on that day.');
      if (!row.check_out && !tout && note.length < 3) throw new BadRequestException('There is no Out punch. Enter the time they left, or a note saying why.');
      await this.manager.query(
        `update hr_attendance set verification_status = 'VERIFIED', reviewed_by = $3, reviewed_on = now(), note = coalesce(nullif($4, ''), note),
                check_in = coalesce(($5::text)::timestamp at time zone '${TZ}', check_in), check_out = coalesce(($6::text)::timestamp at time zone '${TZ}', check_out)
          where employee_id = $1 and att_date = $2::date`, [e.id, date, user.id, note, ts(tin), ts(tout)]);
    } else if (action === 'SET') {
      if (!STATUSES.includes(String(b?.status))) throw new BadRequestException('Choose Present, Half day or Absent.');
      if (note.length < 3) throw new BadRequestException('Say why the day is being changed.');
      await this.manager.query(
        `insert into hr_attendance (employee_id, att_date, status, check_in, check_out, source, verification_status, reviewed_by, reviewed_on, note, created_by)
         values ($1, $2::date, $3, ($4::text)::timestamp at time zone '${TZ}', ($5::text)::timestamp at time zone '${TZ}', 'MANUAL', 'CORRECTED', $6, now(), $7, $6)
         on conflict (employee_id, att_date) do update set status = excluded.status, verification_status = 'CORRECTED', reviewed_by = $6, reviewed_on = now(), note = excluded.note,
           check_in = coalesce(excluded.check_in, hr_attendance.check_in), check_out = coalesce(excluded.check_out, hr_attendance.check_out)`,
        [e.id, date, b.status, ts(tin), ts(tout), user.id, note]);
    } else {
      throw new BadRequestException('Choose approve or change.');
    }
    await this.audit.record({ userId: user.id, action: 'hr.attendance_reviewed', entityType: 'hr_attendance', entityId: e.id,
      summary: `${e.name} ${date}: ${action === 'APPROVE' ? 'approved' : 'changed to ' + b.status}`, details: { note, check_in: tin, check_out: tout } });
    return { ok: true };
  }

  async photo(punchId: number, user: any): Promise<Buffer> {
    const c = await this.ctx(user);
    const [p] = await this.manager.query(`select photo_path, employee_id from hr_punch where id = $1`, [punchId]);
    if (!p) throw new NotFoundException('No such punch.');
    await this.person(c, p.employee_id);
    if (!p.photo_path) throw new NotFoundException('The photo has been removed (photos are kept for a limited time).');
    return readFileSync(uploadedFilePath(p.photo_path));
  }

  // ------------------------------------------------------------------ PINs
  async people(user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    return this.manager.query(
      `select e.id, coalesce(e.full_name, u.full_name) as name, e.designation, (select s.location from stores s where s.id = e.store_id) as store, e.punch_enabled as enabled,
              (e.punch_pin_hash is not null) as has_pin, (e.punch_locked_until is not null and e.punch_locked_until > now()) as locked
         from hr_employee e left join app_user u on u.id = e.user_id
        where e.status = 'ACTIVE' and ${this.scope(c, args)} order by coalesce(e.full_name, u.full_name)`, args);
  }

  async setPin(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const e = await this.person(c, id);
    const enabled = b?.enabled !== false;
    if (!enabled) {
      await this.manager.query(`update hr_employee set punch_enabled = false, punch_fails = 0, punch_locked_until = null where id = $1`, [e.id]);
      await this.audit.record({ userId: user.id, action: 'hr.punch_disabled', entityType: 'hr_employee', entityId: e.id, summary: `${e.name}: attendance punch switched off`, details: {} });
      return { ok: true };
    }
    const [cur] = await this.manager.query(`select punch_pin_hash from hr_employee where id = $1`, [e.id]);
    let pin: string | null = null, shown: string | null = null;
    if (b?.pin) {
      if (!isValidPin(b.pin)) throw new BadRequestException('A PIN is 4 to 6 digits.');
      pin = String(b.pin);
    } else if (b?.generate || !cur?.punch_pin_hash) {
      pin = generatePin(); shown = pin;
    }
    await this.manager.query(
      pin ? `update hr_employee set punch_enabled = true, punch_pin_hash = $2, punch_fails = 0, punch_locked_until = null where id = $1`
          : `update hr_employee set punch_enabled = true, punch_fails = 0, punch_locked_until = null where id = $1`,
      pin ? [e.id, await bcrypt.hash(pin, 8)] : [e.id]);
    await this.audit.record({ userId: user.id, action: pin ? 'hr.punch_pin_set' : 'hr.punch_enabled', entityType: 'hr_employee', entityId: e.id, summary: `${e.name}: ${pin ? 'punch PIN set' : 'punch unlocked'}`, details: {} });
    return { ok: true, pin: shown };
  }
}

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { isOwnerRole } from 'src/core/roles';
import { SaleContext, SavedSaleContext } from 'src/core/sale-hooks/sale-hooks';
import {
  Schedule, SCHEDULES, ScheduledProduct, detailProblems, draftEntries, normaliseDetail, parseRequired, requiredLines, scheduledLines, schedulesOf, serialLabel,
} from './drug-register-rules';
import { buildRegisterPdf } from './drug-register-pdf';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const isDay = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const asNumber = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * The online register of Schedule H, H1 and X drugs (pharmacy pack). The counter writes it through the bill: a bill with a scheduled drug cannot be
 * completed without the patient and the prescriber, and completing it writes one numbered register line for each scheduled drug supplied, in the
 * bill's own transaction. A bill changed afterwards supersedes its lines; nothing is deleted.
 */
@Injectable()
export class DrugRegisterService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------ settings
  async required(m: EntityManager = this.manager): Promise<Schedule[]> {
    const [s] = await m.query(`select setting_value from app_setting where setting_key = 'schedule_register_required' and active and not archive limit 1`);
    return parseRequired(s ? (s.setting_value ?? '') : undefined);
  }

  async since(m: EntityManager = this.manager): Promise<string> {
    const [s] = await m.query(`select setting_value from app_setting where setting_key = 'schedule_register_from' and active and not archive limit 1`);
    return isDay(s?.setting_value) ? s.setting_value : istDay();
  }

  async config() { return { required: await this.required(), since: await this.since() }; }

  // ------------------------------------------------------------------ the bill
  private async scheduledProducts(m: EntityManager, productIds: number[]): Promise<ScheduledProduct[]> {
    if (!productIds.length) return [];
    return (await m.query(
      `select id, title, upper(more_props->>'schedule') as schedule, pack from product where id = any($1::int[]) and upper(more_props->>'schedule') in ('H', 'H1', 'X')`, [productIds]))
      .map((p: any) => ({ id: +p.id, title: String(p.title), schedule: p.schedule as Schedule, pack: p.pack === null ? null : +p.pack }));
  }

  private billLines(sale: any, items: any[] = sale?.items || []) {
    return (Array.isArray(items) ? items : []).map((i: any) => ({
      id: i.id ? +i.id : undefined, itemid: i.itemid ?? i.purchaseitemid ?? i.purchase_item_id, productid: asNumber(i.productid ?? i.product_id), batch: i.batch, qty: asNumber(i.qty),
    })).filter((l) => l.productid > 0);
  }

  /** the hook before a bill is saved: a completed bill with a scheduled drug needs the patient and the prescriber */
  async check(ctx: SaleContext) {
    if (String(ctx.sale?.status || '').toUpperCase() !== 'COMPLETE') return;
    const lines = this.billLines(ctx.sale);
    const scheduled = scheduledLines(lines, await this.scheduledProducts(ctx.manager, [...new Set(lines.map((l) => l.productid))]));
    const need = requiredLines(scheduled, await this.required(ctx.manager));
    if (!need.length) return;
    const problems = detailProblems(ctx.sale?.props?.scheduledetail, istDay());
    if (!problems.length) return;
    const names = [...new Set(need.map((n) => n.product.title))].slice(0, 3).join(', ');
    throw new BadRequestException(`This bill has a scheduled drug (Schedule ${schedulesOf(need).join(', ')}: ${names}). Give ${problems.join(', ')} before completing it.`);
  }

  private async prescriberId(m: EntityManager, businessId: number, d: ReturnType<typeof normaliseDetail>, userId: number): Promise<number> {
    const [r] = await m.query(
      `insert into prescriber (business_id, name, reg_no, address, created_by) values ($1, $2, $3, $4, $5)
       on conflict (business_id, upper(name), coalesce(upper(reg_no), '')) do update set address = coalesce(nullif(excluded.address, ''), prescriber.address) returning id`,
      [businessId, d.prescriber_name, d.prescriber_reg_no || null, d.prescriber_address || null, userId]);
    return r.id;
  }

  /** the hook inside the bill's transaction: its register lines are replaced by the bill as it now stands */
  async saved(ctx: SavedSaleContext) {
    const m = ctx.manager;
    const saleId = ctx.saved.id;
    const by = ctx.actingUserId ?? ctx.userId;
    await m.query(`update schedule_register set superseded_on = now(), superseded_by = $2 where sale_id = $1 and superseded_on is null`, [saleId, ctx.userId]);
    if (String(ctx.sale?.status || ctx.saved?.status || '').toUpperCase() !== 'COMPLETE') return;

    const lines = this.billLines(ctx.sale, ctx.items);
    const scheduled = scheduledLines(lines, await this.scheduledProducts(m, [...new Set(lines.map((l) => l.productid))]));
    if (!scheduled.length) return;
    const raw = ctx.sale?.props?.scheduledetail;
    if (detailProblems(raw, istDay()).length) return;          // only drugs the setting does not cover, and no details given: nothing to record
    const d = normaliseDetail(raw);

    const storeId = ctx.storeId ?? ctx.saved?.storeid ?? null;
    const [st] = storeId ? await m.query(`select business_id from stores where id = $1`, [storeId]) : [null];
    if (!st) return;
    const businessId = +st.business_id;
    const prescriberId = await this.prescriberId(m, businessId, d, ctx.userId);
    const drafts = draftEntries(scheduled);
    const expiry = drafts.length ? await m.query(`select id, exp_date from purchase_invoice_item where id = any($1::int[])`, [drafts.map((x) => x.itemid).filter(Boolean)]) : [];
    const expOf = new Map<number, string | null>(expiry.map((e: any) => [+e.id, e.exp_date]));
    const entryOn = ctx.saved?.billdate ? new Date(ctx.saved.billdate) : new Date();

    const next = new Map<string, number>();
    for (const x of drafts) {
      if (!next.has(x.schedule)) {
        await m.query(`select pg_advisory_xact_lock(hashtext($1))`, [`drugreg:${businessId}:${x.schedule}`]);
        const [mx] = await m.query(`select coalesce(max(serial_no), 0)::int as n from schedule_register where business_id = $1 and schedule = $2`, [businessId, x.schedule]);
        next.set(x.schedule, mx.n);
      }
      const serial = (next.get(x.schedule) as number) + 1;
      next.set(x.schedule, serial);
      await m.query(
        `insert into schedule_register (business_id, store_id, schedule, serial_no, sale_id, sale_item_id, entry_on, bill_no, product_id, drug_name, batch, exp_date, qty, pack,
            patient_name, patient_address, patient_age, prescriber_id, prescriber_name, prescriber_reg_no, prescriber_address, rx_date, supplied_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [businessId, storeId, x.schedule, serial, saleId, x.sale_item_id, entryOn, ctx.saved?.billno ?? null, x.product_id, x.drug_name, x.batch, x.itemid ? expOf.get(+x.itemid) ?? null : null, x.qty, x.pack,
          d.patient_name, d.patient_address || null, d.patient_age || null, prescriberId, d.prescriber_name, d.prescriber_reg_no || null, d.prescriber_address || null, d.rx_date, by]);
    }
  }

  // ------------------------------------------------------------------ prescribers (for the counter)
  async prescribers(user: any, q: string) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) return [];
    const term = String(q || '').trim();
    return this.manager.query(
      `select id, name, reg_no, address from prescriber where business_id = $1 and active and ($2 = '' or upper(name) like upper($2) || '%' or upper(coalesce(reg_no, '')) like upper($2) || '%')
        order by name limit 12`, [businessId, term]);
  }

  // ------------------------------------------------------------------ reading the register
  private async scope(user: any) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user.roleid || 0]);
    const stores = isOwnerRole(role?.name)
      ? await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive order by id`, [businessId])
      : await this.manager.query(
        `select s.id, s.location from stores s join user_stores us on us.store_id = s.id and us.user_id = $2 and us.active and not us.archive where s.business_id = $1 and s.active and not s.archive order by s.id`, [businessId, user.id]);
    const [b] = await this.manager.query(`select name, address, gstin from business where id = $1`, [businessId]);
    return { businessId, stores: stores.map((s: any) => ({ id: +s.id, location: String(s.location).trim() })), business: b };
  }

  private filters(q: any, businessId: number, ids: number[]) {
    const to = isDay(q?.to) ? q.to : istDay();
    const from = isDay(q?.from) ? q.from : addDays(to, -29);
    if (from > to) throw new BadRequestException('The period starts after it ends.');
    const args: any[] = [businessId, ids, from, to];
    const where = [`r.business_id = $1`, `r.store_id = any($2::int[])`, `r.entry_on >= ($3::date)::timestamp at time zone 'Asia/Kolkata'`, `r.entry_on < (($4::date) + 1)::timestamp at time zone 'Asia/Kolkata'`];
    const sch = String(q?.schedule || '').toUpperCase();
    if ((SCHEDULES as readonly string[]).includes(sch)) { args.push(sch); where.push(`r.schedule = $${args.length}`); }
    const term = String(q?.q || '').trim().slice(0, 60);
    if (term) {
      args.push('%' + term.toUpperCase() + '%');
      const i = args.length;
      where.push(`(upper(r.patient_name) like $${i} or upper(r.prescriber_name) like $${i} or upper(r.drug_name) like $${i} or upper(coalesce(r.batch, '')) like $${i} or r.bill_no::text like $${i})`);
    }
    if (String(q?.superseded) !== 'true') where.push('r.superseded_on is null');
    return { from, to, args, where };
  }

  private async rows(user: any, q: any) {
    const sc = await this.scope(user);
    const storeId = Number(q?.storeid) || null;
    if (storeId && !sc.stores.some((s) => s.id === storeId)) throw new BadRequestException('That store is not one you can see.');
    const ids = storeId ? [storeId] : sc.stores.map((s) => s.id);
    const f = this.filters(q, sc.businessId, ids);
    const limit = Math.min(Math.max(Number(q?.limit) || 1000, 1), 5000);
    const rows = await this.manager.query(
      `select r.id, r.schedule, r.serial_no, to_char(r.entry_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as entry_on, r.bill_no, r.sale_id, r.drug_name, r.batch, to_char(r.exp_date, 'YYYY-MM-DD') as exp_date,
              r.qty, r.pack, r.patient_name, r.patient_address, r.patient_age, r.prescriber_name, r.prescriber_reg_no, r.prescriber_address, to_char(r.rx_date, 'YYYY-MM-DD') as rx_date,
              st.location as store, u.full_name as supplied_by, (r.superseded_on is not null) as superseded
         from schedule_register r left join stores st on st.id = r.store_id left join app_user u on u.id = r.supplied_by
        where ${f.where.join(' and ')} order by r.schedule, r.serial_no limit ${limit}`, f.args);
    return { rows: rows.map((r: any) => ({ ...r, label: serialLabel(r.schedule, r.serial_no) })), sc, from: f.from, to: f.to, schedule: String(q?.schedule || '').toUpperCase() };
  }

  async register(user: any, q: any) {
    const { rows, sc, from, to } = await this.rows(user, q);
    const totals: Record<string, { lines: number; units: number }> = {};
    for (const s of SCHEDULES) totals[s] = { lines: 0, units: 0 };
    rows.filter((r: any) => !r.superseded).forEach((r: any) => { totals[r.schedule].lines += 1; totals[r.schedule].units += r.qty; });
    return { from, to, rows, totals, stores: sc.stores, ...(await this.config()), coverage: await this.coverage(user) };
  }

  /** scheduled drugs sold since the register began that have no register line: the bill was made some other way, or before the details were asked for */
  async coverage(user: any) {
    const sc = await this.scope(user);
    const required = await this.required();
    const since = await this.since();
    const ids = sc.stores.map((s) => s.id);
    if (!ids.length) return { since, required, missing: 0, items: [], months: [] };
    const none = !required.length;          // nothing is required: no sale can be missing, but the register still has its lines to count
    const miss = none ? [] : await this.manager.query(
      `select s.id as sale_id, s.bill_no, to_char(s.bill_date, 'YYYY-MM-DD') as day, p.title, upper(p.more_props->>'schedule') as schedule, si.qty
         from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id
        where si.status = 'Complete' and si.active and not si.archive and upper(p.more_props->>'schedule') = any($1::text[]) and s.bill_date >= $2::date and s.store_id = any($3::int[])
          and not exists (select 1 from schedule_register r where r.sale_item_id = si.id and r.superseded_on is null)
        order by s.bill_date desc limit 100`, [required, since, ids]);
    const [cnt] = none ? [{ n: 0 }] : await this.manager.query(
      `select count(*)::int as n from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id
        where si.status = 'Complete' and si.active and not si.archive and upper(p.more_props->>'schedule') = any($1::text[]) and s.bill_date >= $2::date and s.store_id = any($3::int[])
          and not exists (select 1 from schedule_register r where r.sale_item_id = si.id and r.superseded_on is null)`, [required, since, ids]);
    const months = await this.manager.query(
      `select to_char(entry_on at time zone 'Asia/Kolkata', 'YYYY-MM') as month, schedule, count(*)::int as lines from schedule_register where business_id = $1 and superseded_on is null and store_id = any($2::int[])
        group by 1, 2 order by 1 desc, 2`, [sc.businessId, ids]);
    return { since, required, missing: cnt.n, items: miss, months };
  }

  // ------------------------------------------------------------------ printing
  private title(schedule: string) { return schedule ? `REGISTER OF SCHEDULE ${schedule} DRUGS` : 'REGISTER OF SCHEDULE H, H1 AND X DRUGS'; }

  async pdf(user: any, q: any) {
    const { rows, sc, from, to, schedule } = await this.rows(user, { ...q, limit: 5000 });
    const buffer = await buildRegisterPdf(rows, { business: String(sc.business?.name ?? 'Pharmacy').trim(), address: sc.business?.address ? String(sc.business.address).trim() : undefined, gstin: sc.business?.gstin ?? undefined,
      title: this.title(schedule), from, to, generatedAt: new Date() });
    await this.audit.record({ userId: user.id, action: 'drug_register.printed', entityType: 'schedule_register', entityId: null, summary: `Drug register printed (${schedule || 'H, H1, X'}, ${from} to ${to}, ${rows.length} lines)`, details: { schedule, from, to, lines: rows.length } });
    return { buffer, filename: `drug-register-${schedule || 'all'}-${from}-to-${to}.pdf`, contentType: 'application/pdf' };
  }

  async xlsx(user: any, q: any) {
    const { rows, from, to, schedule } = await this.rows(user, { ...q, limit: 5000 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Register', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Register no', key: 'label', width: 12 }, { header: 'Date and time', key: 'entry_on', width: 17 }, { header: 'Bill', key: 'bill_no', width: 8 }, { header: 'Schedule', key: 'schedule', width: 9 },
      { header: 'Drug', key: 'drug_name', width: 36 }, { header: 'Batch', key: 'batch', width: 14 }, { header: 'Expiry', key: 'exp_date', width: 11 }, { header: 'Units', key: 'qty', width: 7 },
      { header: 'Patient', key: 'patient_name', width: 24 }, { header: 'Patient address', key: 'patient_address', width: 36 }, { header: 'Age', key: 'patient_age', width: 6 },
      { header: 'Prescriber', key: 'prescriber_name', width: 24 }, { header: 'Registration no', key: 'prescriber_reg_no', width: 16 }, { header: 'Prescriber address', key: 'prescriber_address', width: 32 },
      { header: 'Prescription date', key: 'rx_date', width: 12 }, { header: 'Supplied by', key: 'supplied_by', width: 18 }, { header: 'Store', key: 'store', width: 16 }, { header: 'Superseded', key: 'sup', width: 10 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r: any) => ws.addRow({ ...r, sup: r.superseded ? 'yes' : '' }));
    await this.audit.record({ userId: user.id, action: 'drug_register.exported', entityType: 'schedule_register', entityId: null, summary: `Drug register exported (${schedule || 'H, H1, X'}, ${from} to ${to}, ${rows.length} lines)`, details: { schedule, from, to, lines: rows.length } });
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `drug-register-${schedule || 'all'}-${from}-to-${to}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
}

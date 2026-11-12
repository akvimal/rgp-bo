import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { isOwnerRole } from 'src/core/roles';
import { SaleContext, SavedSaleContext } from 'src/core/sale-hooks/sale-hooks';
import {
  Rx, RX_LABELS, Schedule, SCHEDULES, ScheduledProduct, detailProblems, prescriberProblems, withoutPrescription, distinctPatients, distinctPrescribers, draftEntries, normaliseDetail, normaliseRx, parseRequired, parseStandingMonths, requiredLines, rxProblems, scheduledLines, schedulesOf, serialLabel, standingState,
} from './drug-register-rules';
import { NIL_MOBILE } from 'src/modules/app/customers/customer-rules';
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

  /**
   * the schedules whose bills are held back until the patient and the prescriber are given; the others can be completed and the details added later.
   * The setting is a list ("H1,X"); "yes" means every schedule, and "no" or nothing means none.
   */
  async enforced(m: EntityManager = this.manager): Promise<Schedule[]> {
    const [s] = await m.query(`select setting_value from app_setting where setting_key = 'schedule_register_enforce' and active and not archive limit 1`);
    const v = String(s?.setting_value ?? '').trim().toLowerCase();
    if (v === 'yes') return [...SCHEDULES];
    if (!v || v === 'no') return [];
    return parseRequired(v);
  }

  /** months a prescription on file can be used again for a repeat supply of a chronic medicine */
  async standingMonths(m: EntityManager = this.manager): Promise<number> {
    const [s] = await m.query(`select setting_value from app_setting where setting_key = 'schedule_standing_months' and active and not archive limit 1`);
    return parseStandingMonths(s?.setting_value);
  }

  async config() { return { required: await this.required(), since: await this.since(), enforce: await this.enforced(), standing_months: await this.standingMonths() }; }

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

  /** the hook before a bill is saved: a completed bill with a drug of a schedule the shop holds back needs the patient and the prescriber */
  async check(ctx: SaleContext) {
    if (String(ctx.sale?.status || '').toUpperCase() !== 'COMPLETE') return;
    const lines = this.billLines(ctx.sale);
    const scheduled = scheduledLines(lines, await this.scheduledProducts(ctx.manager, [...new Set(lines.map((l) => l.productid))]));
    const covered = requiredLines(scheduled, await this.required(ctx.manager));
    if (!covered.length) return;
    const basisProblems = rxProblems(ctx.sale?.props?.scheduledetail, ctx.sale?.props?.documents, istDay());
    if (basisProblems.length) throw new BadRequestException(`This bill has a scheduled drug. Give ${basisProblems.join(', ')}.`);
    const walkIn = normaliseRx(ctx.sale?.props?.scheduledetail, ctx.sale?.props?.documents).basis === 'LATER' && String(ctx.sale?.customer?.mobile ?? '') === NIL_MOBILE;
    if (walkIn) throw new BadRequestException('A prescription to follow needs a customer on record to ask: add the customer to the bill.');
    const enforced = await this.enforced(ctx.manager);
    const need = covered.filter((n) => enforced.includes(n.product.schedule));
    if (!need.length) return;
    const basisNow = normaliseRx(ctx.sale?.props?.scheduledetail, ctx.sale?.props?.documents).basis;
    const problems = detailProblems(ctx.sale?.props?.scheduledetail, istDay(), basisNow);
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
    const storeId = ctx.storeId ?? ctx.saved?.storeid ?? null;
    if (String(ctx.sale?.status || ctx.saved?.status || '').toUpperCase() !== 'COMPLETE') { await this.syncFollowup(m, { storeId, saleId, customerId: 0, rx: normaliseRx(null), userId: ctx.userId }); return; }

    const lines = this.billLines(ctx.sale, ctx.items);
    const scheduled = scheduledLines(lines, await this.scheduledProducts(m, [...new Set(lines.map((l) => l.productid))]));
    const raw = ctx.sale?.props?.scheduledetail;
    const rx = scheduled.length ? normaliseRx(raw, ctx.sale?.props?.documents) : normaliseRx(null);
    await this.syncFollowup(m, { storeId, saleId, customerId: ctx.saved?.customerid ?? 0, rx, userId: ctx.userId });
    if (!scheduled.length) return;
    if (detailProblems(raw, istDay(), rx.basis).length) return;          // only drugs the setting does not cover, and no details given: nothing to record
    const d = normaliseDetail(raw);

    await this.writeEntries(m, { storeId, saleId, billNo: ctx.saved?.billno ?? null, billDate: ctx.saved?.billdate ? new Date(ctx.saved.billdate) : new Date(), scheduled, d, rx, userId: ctx.userId, by });
  }

  /** a voided bill: its register lines are marked withdrawn (the register is never deleted from) and its promised-prescription follow-up is closed */
  async voided(ctx: { manager: EntityManager; saleId: number; userId: number; reason: string }) {
    await ctx.manager.query(`update schedule_register set superseded_on = now(), superseded_by = $2 where sale_id = $1 and superseded_on is null`, [ctx.saleId, ctx.userId]);
    await ctx.manager.query(`update schedule_rx_followup set status = 'CANCELLED', closed_on = now(), closed_by = $2 where sale_id = $1 and status = 'OPEN'`, [ctx.saleId, ctx.userId]);
  }

  /** a prescription promised for later leaves a follow-up on the customer; a bill changed or cancelled takes its follow-up back */
  private async syncFollowup(m: EntityManager, a: { storeId: number | null; saleId: number; customerId: any; rx: Rx; userId: number }) {
    await m.query(`update schedule_rx_followup set status = 'CANCELLED', closed_on = now(), closed_by = $2 where sale_id = $1 and status = 'OPEN'`, [a.saleId, a.userId]);
    if (a.rx.basis !== 'LATER' || !a.rx.due || !a.storeId || !(Number(a.customerId) > 0)) return;
    const [c] = await m.query(`select c.id, st.business_id from customer c, stores st where c.id = $1 and st.id = $2 and c.mobile is distinct from $3`, [Number(a.customerId), a.storeId, NIL_MOBILE]);
    if (!c) return;
    await m.query(
      `insert into schedule_rx_followup (business_id, store_id, sale_id, customer_id, due_on, note, created_by) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (sale_id) do update set status = 'OPEN', due_on = excluded.due_on, note = excluded.note, customer_id = excluded.customer_id, closed_on = null, closed_by = null
       where schedule_rx_followup.status in ('OPEN', 'CANCELLED')`,
      [c.business_id, a.storeId, a.saleId, c.id, a.rx.due, a.rx.note || null, a.userId]);
  }

  /** one numbered register line for each scheduled drug on a bill, with its patient and prescriber */
  private async writeEntries(m: EntityManager, a: { storeId: number | null; saleId: number; billNo: any; billDate: Date; scheduled: ReturnType<typeof scheduledLines>; d: ReturnType<typeof normaliseDetail>; rx: Rx; userId: number; by: number }) {
    const { storeId, saleId, scheduled, d } = a;
    const [st] = storeId ? await m.query(`select business_id from stores where id = $1`, [storeId]) : [null];
    if (!st) return;
    const businessId = +st.business_id;
    // no prescription in hand: no prescriber to record, so no prescriber row is made (the register line says why)
    const prescriberId = d.prescriber_name.length >= 3 ? await this.prescriberId(m, businessId, d, a.userId) : null;
    const drafts = draftEntries(scheduled);
    const expiry = drafts.length ? await m.query(`select id, exp_date from purchase_invoice_item where id = any($1::int[])`, [drafts.map((x) => x.itemid).filter(Boolean)]) : [];
    const expOf = new Map<number, string | null>(expiry.map((e: any) => [+e.id, e.exp_date]));
    const entryOn = a.billDate;

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
            patient_name, patient_address, patient_age, prescriber_id, prescriber_name, prescriber_reg_no, prescriber_address, rx_date, supplied_by, rx_basis, rx_note, rx_document_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [businessId, storeId, x.schedule, serial, saleId, x.sale_item_id, entryOn, a.billNo, x.product_id, x.drug_name, x.batch, x.itemid ? expOf.get(+x.itemid) ?? null : null, x.qty, x.pack,
          d.patient_name, d.patient_address || null, d.patient_age || null, prescriberId, d.prescriber_name, d.prescriber_reg_no || null, d.prescriber_address || null, d.rx_date, a.by,
          a.rx.basis, a.rx.note || null, a.rx.documentId]);
    }
  }

  /**
   * Details for a bill that was completed without them: a manager gives the patient and the prescriber, and the register lines are written as if the bill
   * had carried them (dated as the bill). A bill that already has its lines is left as it is.
   */
  async addDetails(user: any, saleId: number, raw: any) {
    const sc = await this.scope(user);
    const [sale] = await this.manager.query(`select id, store_id, bill_no, bill_date, status, customer_id, more_props from sale where id = $1 and active and not archive`, [Number(saleId) || 0]);
    if (!sale || !sc.stores.some((s) => s.id === +sale.store_id)) throw new NotFoundException('Bill not found.');
    if (String(sale.status).toUpperCase() !== 'COMPLETE') throw new BadRequestException('Only a completed bill has register lines.');
    const kept = typeof sale.more_props === 'string' ? JSON.parse(sale.more_props || '{}') : sale.more_props || {};
    const source = raw?.rx_basis ? raw : kept.scheduledetail;
    const rx = normaliseRx(source, kept.documents);
    const problems = detailProblems(raw, istDay(), rx.basis);
    if (problems.length) throw new BadRequestException(`Give ${problems.join(', ')}.`);
    const d = normaliseDetail(raw);
    const rxIssues = rxProblems(source, kept.documents, istDay());
    if (rxIssues.length) throw new BadRequestException(`Give ${rxIssues.join(', ')}.`);
    const rows = await this.manager.query(
      `select si.id, si.purchase_item_id as itemid, si.product_id as productid, si.batch, si.qty from sale_item si
        where si.sale_id = $1 and si.status = 'Complete' and si.active and not si.archive`, [sale.id]);
    await this.manager.transaction(async (m) => {
      const lines = this.billLines({}, rows);
      const scheduled = scheduledLines(lines, await this.scheduledProducts(m, [...new Set(lines.map((l) => l.productid))]));
      if (!scheduled.length) throw new BadRequestException('This bill has no scheduled drug.');
      const [have] = await m.query(`select count(*)::int as n from schedule_register where sale_id = $1 and superseded_on is null`, [sale.id]);
      if (have.n) throw new BadRequestException('This bill already has its register lines.');
      await this.writeEntries(m, { storeId: +sale.store_id, saleId: +sale.id, billNo: sale.bill_no, billDate: new Date(sale.bill_date), scheduled, d, rx, userId: user.id, by: user.id });
      await this.syncFollowup(m, { storeId: +sale.store_id, saleId: +sale.id, customerId: sale.customer_id, rx, userId: user.id });
    });
    await this.audit.record({ userId: user.id, action: 'drug_register.details_added', entityType: 'sale', entityId: +sale.id, summary: `Register details added to bill ${sale.bill_no}`, details: { patient: d.patient_name, prescriber: d.prescriber_name } });
    return { sale_id: +sale.id };
  }

  // ------------------------------------------------------------------ supplies with no prescriber yet
  /**
   * The supplies whose register line has no prescriber: made with no prescription in hand. Each says how it stands (the reason, or "attached" once the
   * prescription has arrived, when the prescriber can be added). Bills of the stores the person can see, newest first.
   */
  async prescriberGaps(user: any) {
    const sc = await this.scope(user);
    const ids = sc.stores.map((s) => s.id);
    if (!ids.length) return { rows: [] };
    const rows = await this.manager.query(
      `select r.sale_id, r.bill_no, to_char(min(r.entry_on at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') as day, st.location as store,
              string_agg(distinct r.drug_name, ', ') as drugs, count(*)::int as lines, max(r.patient_name) as patient_name,
              max(r.rx_basis) as rx_basis, max(r.rx_note) as rx_note
         from schedule_register r left join stores st on st.id = r.store_id
        where r.business_id = $1 and r.store_id = any($2::int[]) and r.superseded_on is null and length(btrim(r.prescriber_name)) < 3
        group by r.sale_id, r.bill_no, st.location order by min(r.entry_on) desc limit 200`, [sc.businessId, ids]);
    return { rows: rows.map((r: any) => ({ ...r, rx_label: r.rx_basis ? (RX_LABELS as any)[r.rx_basis] ?? r.rx_basis : '', can_add: !withoutPrescription(r.rx_basis) })) };
  }

  /** the prescriber of a supply made without one, once the prescription has arrived: the register lines of the bill are completed (and audited) */
  async addPrescriber(user: any, saleId: number, raw: any) {
    const sc = await this.scope(user);
    const [sale] = await this.manager.query(`select id, store_id from sale where id = $1 and active and not archive`, [Number(saleId) || 0]);
    if (!sale || !sc.stores.some((s) => s.id === +sale.store_id)) throw new NotFoundException('Bill not found.');
    const lines = await this.manager.query(
      `select id, rx_basis from schedule_register where sale_id = $1 and superseded_on is null and length(btrim(prescriber_name)) < 3`, [sale.id]);
    if (!lines.length) throw new BadRequestException('This bill has no register line without a prescriber.');
    const stuck = lines.find((l: any) => withoutPrescription(l.rx_basis));
    if (stuck) throw new BadRequestException(`There is no prescription on this bill yet (${(RX_LABELS as any)[stuck.rx_basis] ?? stuck.rx_basis}). Attach the prescription to the bill first, then add the prescriber.`);
    const problems = prescriberProblems(raw, istDay());
    if (problems.length) throw new BadRequestException(`Give ${problems.join(', ')}.`);
    const d = normaliseDetail(raw);
    await this.manager.transaction(async (m) => {
      const pid = await this.prescriberId(m, sc.businessId, d, user.id);
      await m.query(
        `update schedule_register set prescriber_id = $2, prescriber_name = $3, prescriber_reg_no = $4, prescriber_address = $5, rx_date = coalesce($6::date, rx_date)
          where sale_id = $1 and superseded_on is null and length(btrim(prescriber_name)) < 3`,
        [sale.id, pid, d.prescriber_name, d.prescriber_reg_no || null, d.prescriber_address || null, d.rx_date]);
      await this.audit.record({ userId: user.id, action: 'drug_register.prescriber_added', entityType: 'sale', entityId: +sale.id, summary: `Prescriber added to the register lines of sale ${sale.id}`,
        details: { lines: lines.length, prescriber: d.prescriber_name } });
    });
    return { sale_id: +sale.id, lines: lines.length };
  }

  // ------------------------------------------------------------------ what is already on record for a customer (for the counter)
  /**
   * The prescriptions kept with the customer and the patient and prescriber of their last supplies, so a bill for a regular customer can use them with one tap
   * instead of asking again. A prescription's doctor is matched to the prescribers the shop already knows, for the registration number.
   */
  async customerContext(user: any, customerId: number) {
    const businessId = await businessOfUser(this.manager, user.id);
    const months = await this.standingMonths();
    if (!businessId || !(Number(customerId) > 0)) return { prescriptions: [], last: [], patients: [], prescribers: [], standing_months: months };
    await this.settleFollowups();
    const docs = await this.manager.query(
      `select d.id, d.doc_name as name, d.doc_path as path, d.alias, d.category, d.doc_props, to_char(d.created_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as added
         from customer_documents cd join documents d on d.id = cd.document_id
        where cd.customer_id = $1 and cd.active and not cd.archive and d.active and not d.archive and lower(d.category) = 'prescription'
        order by d.created_on desc limit 5`, [customerId]);
    const prescriptions: any[] = [];
    for (const d of docs) {
      let props: any = d.doc_props;
      if (typeof props === 'string') { try { props = JSON.parse(props); } catch { props = []; } }
      const get = (id: string) => String((Array.isArray(props) ? props.find((x: any) => x?.id === id)?.value : '') ?? '').trim();
      const doctor = get('doctorname');
      const [match] = doctor ? await this.manager.query(`select reg_no, address from prescriber where business_id = $1 and active and upper(name) = upper($2) limit 1`, [businessId, doctor]) : [null];
      const date = get('prescdate');
      prescriptions.push({
        id: d.id, name: d.name, path: d.path, alias: d.alias, category: d.category, docprops: JSON.stringify(Array.isArray(props) ? props : []), added: d.added,
        doctor, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', patient: get('ptntname'), reg_no: match?.reg_no ?? '', address: match?.address ?? '',
        ...standingState(/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : d.added, istDay(), months),
      });
    }
    const last = await this.manager.query(
      `select * from (
         select distinct on (upper(r.patient_name), upper(r.prescriber_name)) r.patient_name, r.patient_address, r.patient_age, r.prescriber_name, r.prescriber_reg_no, r.prescriber_address,
                to_char(r.rx_date, 'YYYY-MM-DD') as rx_date, r.bill_no, to_char(r.entry_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as entry_on, r.entry_on as at
           from schedule_register r join sale s on s.id = r.sale_id
          where s.customer_id = $1 and r.business_id = $2 and r.superseded_on is null
          order by upper(r.patient_name), upper(r.prescriber_name), r.entry_on desc) x
        order by x.at desc limit 3`, [customerId, businessId]);
    // the people on this customer's earlier supplies, for the chips on the bill (their own records only)
    const earlier = await this.manager.query(
      `select r.patient_name, r.patient_address, r.patient_age, r.prescriber_name, r.prescriber_reg_no, r.prescriber_address,
              to_char(r.entry_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as entry_on
         from schedule_register r join sale s on s.id = r.sale_id
        where s.customer_id = $1 and r.business_id = $2 and r.superseded_on is null
        order by r.entry_on desc limit 60`, [customerId, businessId]);
    return { prescriptions, patients: distinctPatients(earlier), prescribers: distinctPrescribers(earlier), standing_months: months, last: last.map(({ at, ...rest }: any) => ({ ...rest, ...standingState(rest.rx_date || rest.entry_on, istDay(), months) })) };
  }

  /**
   * How the scheduled supplies of a period were covered: those with the patient and the prescriber in the register, those that also carry a prescription
   * picture, and those with no register line at all, by schedule and by the person who made the sale. Only supplies since the register began and of the
   * schedules the shop asks details for are counted.
   */
  async coverageReport(user: any, q: any) {
    const sc = await this.scope(user);
    const storeId = Number(q?.storeid) || null;
    if (storeId && !sc.stores.some((s) => s.id === storeId)) throw new BadRequestException('That store is not one you can see.');
    const ids = storeId ? [storeId] : sc.stores.map((s) => s.id);
    const to = isDay(q?.to) ? q.to : istDay();
    const asked = isDay(q?.from) ? q.from : addDays(to, -29);
    if (asked > to) throw new BadRequestException('The period starts after it ends.');
    const since = await this.since();
    const from = asked > since ? asked : since;
    const required = await this.required();
    const empty = { from, to, since, required, totals: { supplies: 0, covered: 0, with_rx: 0, missing: 0 }, by_schedule: [], by_user: [], by_basis: [] };
    if (!ids.length || !required.length || from > to) return empty;
    const rows = await this.manager.query(
      `select upper(p.more_props->>'schedule') as schedule, coalesce(s.acting_user_id, s.created_by) as uid,
              exists (select 1 from schedule_register r where r.sale_item_id = si.id and r.superseded_on is null) as covered,
              coalesce((s.more_props::jsonb -> 'documents') @> '[{"category":"Prescription"}]'::jsonb, false) as has_rx,
              coalesce((select r.rx_basis from schedule_register r where r.sale_item_id = si.id and r.superseded_on is null limit 1), s.more_props::jsonb->'scheduledetail'->>'rx_basis') as basis
         from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id
        where si.status = 'Complete' and si.active and not si.archive and upper(p.more_props->>'schedule') = any($1::text[]) and s.store_id = any($2::int[])
          and s.bill_date >= $3::date and s.bill_date < ($4::date + 1)`, [required, ids, from, to]);
    const tally = () => ({ supplies: 0, covered: 0, with_rx: 0, missing: 0 });
    const add = (t: any, r: any) => { t.supplies += 1; if (r.covered) t.covered += 1; else t.missing += 1; if (r.has_rx) t.with_rx += 1; };
    const totals = tally();
    const bySchedule = new Map<string, any>();
    const byUser = new Map<number, any>();
    const byBasis = new Map<string, number>();
    for (const r of rows) {
      add(totals, r);
      const basis = r.basis || 'NONE';
      byBasis.set(basis, (byBasis.get(basis) ?? 0) + 1);
      if (!bySchedule.has(r.schedule)) bySchedule.set(r.schedule, { schedule: r.schedule, ...tally() });
      add(bySchedule.get(r.schedule), r);
      const uid = r.uid === null ? 0 : +r.uid;
      if (!byUser.has(uid)) byUser.set(uid, { user_id: uid, ...tally() });
      add(byUser.get(uid), r);
    }
    const names = byUser.size ? await this.manager.query(`select id, full_name from app_user where id = any($1::int[])`, [[...byUser.keys()]]) : [];
    const nameOf = new Map<number, string>(names.map((n: any) => [+n.id, String(n.full_name).trim()]));
    return {
      ...empty, totals,
      by_basis: [...byBasis.entries()].map(([basis, supplies]) => ({ basis, label: (RX_LABELS as any)[basis] ?? basis, supplies })).sort((a, b) => b.supplies - a.supplies),
      by_schedule: SCHEDULES.filter((s) => bySchedule.has(s)).map((s) => bySchedule.get(s)),
      by_user: [...byUser.values()].map((u) => ({ ...u, name: nameOf.get(u.user_id) || 'Not recorded' })).sort((a, b) => b.missing - a.missing || b.supplies - a.supplies),
    };
  }

  // ------------------------------------------------------------------ prescriptions promised for later
  /**
   * A follow-up is done when a prescription is kept with the customer after the bill: the register lines of that bill then point to it. Run whenever the
   * follow-ups are read, so nobody has to link the prescription to the bill by hand.
   */
  async settleFollowups(m: EntityManager = this.manager) {
    const done = await m.query(
      `update schedule_rx_followup f set status = 'DONE', closed_on = now(), document_id = x.document_id
         from (select distinct on (f2.id) f2.id as fid, d.id as document_id
                 from schedule_rx_followup f2
                 join customer_documents cd on cd.customer_id = f2.customer_id and cd.active and not cd.archive
                 join documents d on d.id = cd.document_id and d.active and not d.archive and lower(d.category) = 'prescription' and d.created_on > f2.created_on - interval '1 hour'
                where f2.status = 'OPEN' order by f2.id, d.created_on) x
        where f.id = x.fid returning f.sale_id, f.document_id`);
    for (const row of done[0] && Array.isArray(done[0]) ? done[0] : done) {
      await m.query(`update schedule_register set rx_basis = 'ATTACHED', rx_document_id = $2 where sale_id = $1 and rx_basis = 'LATER' and superseded_on is null`, [row.sale_id, row.document_id]);
    }
  }

  /** the prescriptions still to be collected, the oldest promise first, for the customer worklist */
  async followups(user: any) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) return { rows: [] };
    await this.settleFollowups();
    const rows = await this.manager.query(
      `select f.id, f.sale_id, s.bill_no, to_char(s.bill_date, 'YYYY-MM-DD') as day, f.customer_id, c.name as customer_name, c.locality, to_char(f.due_on, 'YYYY-MM-DD') as due_on,
              ((now() at time zone 'Asia/Kolkata')::date - f.due_on)::int as days_over, f.note, u.full_name as by_name,
              (select string_agg(distinct p.title || ' (' || upper(p.more_props->>'schedule') || ')', ', ')
                 from sale_item si join product p on p.id = si.product_id
                where si.sale_id = s.id and si.status = 'Complete' and si.active and not si.archive and upper(p.more_props->>'schedule') in ('H', 'H1', 'X')) as drugs
         from schedule_rx_followup f join sale s on s.id = f.sale_id join customer c on c.id = f.customer_id left join app_user u on u.id = f.created_by
        where f.business_id = $1 and f.status = 'OPEN' order by f.due_on, f.id limit 100`, [businessId]);
    return { rows };
  }

  /** the customer will not bring the prescription: the follow-up is closed and the register lines say so, with the reason */
  async waiveFollowup(user: any, id: number, noteRaw: any) {
    const businessId = await businessOfUser(this.manager, user.id);
    const note = String(noteRaw ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (note.length < 3) throw new BadRequestException('Say in a few words why the prescription is no longer chased.');
    await this.manager.transaction(async (m) => {
      const [f] = await m.query(`select id, sale_id from schedule_rx_followup where id = $1 and business_id = $2 and status = 'OPEN'`, [Number(id) || 0, businessId]);
      if (!f) throw new NotFoundException('That follow-up is not open.');
      await m.query(`update schedule_rx_followup set status = 'WAIVED', note = $2, closed_on = now(), closed_by = $3 where id = $1`, [f.id, note, user.id]);
      await m.query(`update schedule_register set rx_basis = 'COULD_NOT', rx_note = $2 where sale_id = $1 and rx_basis = 'LATER' and superseded_on is null`, [f.sale_id, note]);
      await this.audit.record({ userId: user.id, action: 'drug_register.followup_waived', entityType: 'sale', entityId: +f.sale_id, summary: `Prescription no longer chased for sale ${f.sale_id}`, details: { note } });
    });
    return { id: Number(id) };
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
              r.qty, r.pack, r.patient_name, r.patient_address, r.patient_age, r.prescriber_name, r.prescriber_reg_no, r.prescriber_address, to_char(r.rx_date, 'YYYY-MM-DD') as rx_date, r.rx_basis, r.rx_note, r.rx_document_id,
              st.location as store, u.full_name as supplied_by, (r.superseded_on is not null) as superseded
         from schedule_register r left join stores st on st.id = r.store_id left join app_user u on u.id = r.supplied_by
        where ${f.where.join(' and ')} order by r.schedule, r.serial_no limit ${limit}`, f.args);
    return { rows: rows.map((r: any) => ({ ...r, label: serialLabel(r.schedule, r.serial_no), rx_label: r.rx_basis ? (RX_LABELS as any)[r.rx_basis] ?? r.rx_basis : '' })), sc, from: f.from, to: f.to, schedule: String(q?.schedule || '').toUpperCase() };
  }

  async register(user: any, q: any) {
    const { rows, sc, from, to } = await this.rows(user, q);
    const totals: Record<string, { lines: number; units: number }> = {};
    for (const s of SCHEDULES) totals[s] = { lines: 0, units: 0 };
    rows.filter((r: any) => !r.superseded).forEach((r: any) => { totals[r.schedule].lines += 1; totals[r.schedule].units += r.qty; });
    return { from, to, rows, totals, stores: sc.stores, ...(await this.config()), coverage: await this.coverage(user) };
  }

  /**
   * The disposal side of the register: Schedule H, H1 and X lines of confirmed out-passes (expired or damaged stock that left the shop), numbered in their own series
   * (D-H1-0001). A sale goes in the supplies register; goods destroyed or handed to a disposal agency go here.
   */
  async disposals(user: any, q: any) {
    const sc = await this.scope(user);
    const storeId = Number(q?.storeid) || null;
    if (storeId && !sc.stores.some((s) => s.id === storeId)) throw new BadRequestException('That store is not one you can see.');
    const ids = storeId ? [storeId] : sc.stores.map((s) => s.id);
    const to = isDay(q?.to) ? q.to : istDay();
    const from = isDay(q?.from) ? q.from : addDays(to, -29);
    if (from > to) throw new BadRequestException('The period starts after it ends.');
    const args: any[] = [sc.businessId, ids, from, to];
    let sch = '';
    const want = String(q?.schedule || '').toUpperCase();
    if ((SCHEDULES as readonly string[]).includes(want)) { args.push(want); sch = ` and r.schedule = $${args.length}`; }
    const rows = ids.length ? await this.manager.query(
      `select r.id, r.schedule, r.serial_no, to_char(r.handed_on, 'YYYY-MM-DD') as handed_on, r.drug_name, r.batch, to_char(r.exp_date, 'YYYY-MM-DD') as exp_date, r.qty, r.reason, r.method, r.agency,
              dp.pass_no, dp.id as pass_id, dp.legacy, st.location as store, cu.full_name as confirmed_by, wu.full_name as witness
         from schedule_disposal_register r inner join disposal_pass dp on dp.id = r.pass_id left join stores st on st.id = r.store_id
         left join app_user cu on cu.id = r.confirmed_by left join app_user wu on wu.id = r.witness_id
        where r.business_id = $1 and r.store_id = any($2::int[]) and r.handed_on between $3::date and $4::date${sch}
        order by r.schedule, r.serial_no limit 2000`, args) : [];
    const totals: Record<string, { lines: number; units: number }> = {};
    for (const s of SCHEDULES) totals[s] = { lines: 0, units: 0 };
    rows.forEach((r: any) => { totals[r.schedule].lines += 1; totals[r.schedule].units += r.qty; });
    return { from, to, rows: rows.map((r: any) => ({ ...r, label: `D-${serialLabel(r.schedule, r.serial_no)}` })), totals, stores: sc.stores };
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
      `select s.id as sale_id, s.bill_no, to_char(s.bill_date, 'YYYY-MM-DD') as day, p.title, upper(p.more_props->>'schedule') as schedule, si.qty,
              c.id as customer_id, c.name as customer_name, c.mobile as customer_mobile, c.address as customer_address,
              s.more_props::jsonb->'scheduledetail'->>'rx_basis' as rx_basis, s.more_props::jsonb->'scheduledetail'->>'rx_note' as rx_note
         from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE' join product p on p.id = si.product_id left join customer c on c.id = s.customer_id
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
      { header: 'Prescription date', key: 'rx_date', width: 12 }, { header: 'Prescription', key: 'rx_text', width: 30 }, { header: 'Supplied by', key: 'supplied_by', width: 18 }, { header: 'Store', key: 'store', width: 16 }, { header: 'Superseded', key: 'sup', width: 10 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r: any) => ws.addRow({ ...r, sup: r.superseded ? 'yes' : '', rx_text: [r.rx_label, r.rx_note].filter(Boolean).join(': ') }));
    await this.audit.record({ userId: user.id, action: 'drug_register.exported', entityType: 'schedule_register', entityId: null, summary: `Drug register exported (${schedule || 'H, H1, X'}, ${from} to ${to}, ${rows.length} lines)`, details: { schedule, from, to, lines: rows.length } });
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `drug-register-${schedule || 'all'}-${from}-to-${to}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
}

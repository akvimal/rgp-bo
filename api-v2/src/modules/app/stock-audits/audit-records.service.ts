import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { StockAuditService } from './stock-audit.service';
import { auditNo, financialYear, matchRate, mayCertify, SCOPE_LABEL, standardPlans, variance } from './audit-rules';
import { AuditHead, buildCertificatePdf, buildCountSheetPdf, buildVariancePdf, SheetLine, Totals } from './audit-pdf';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const text = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

/**
 * The paper trail of a stock audit: the count sheet to count on, the variance report of what was found, the certificate signed by two people and
 * kept as printed, the register of all audits for a financial year, and the stock valuation as at a date.
 */
@Injectable()
export class AuditRecordsService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly audits: StockAuditService) {}

  private async head(a: any): Promise<AuditHead> {
    const [b] = await this.manager.query(`select name, address, gstin from business where id = $1`, [a.business_id]);
    const [st] = await this.manager.query(`select location from stores where id = $1`, [a.store_id]);
    const [pl] = a.plan_id ? await this.manager.query(`select name from stock_audit_plan where id = $1`, [a.plan_id]) : [null];
    const [ct] = a.count_id ? await this.manager.query(`select started_on, finished_at, u.full_name from stock_count c left join app_user u on u.id = c.completed_by where c.id = $1`, [a.count_id]) : [null];
    return {
      business: String(b?.name ?? 'Pharmacy').trim(), address: b?.address ? String(b.address).trim() : undefined, gstin: b?.gstin ? String(b.gstin).trim() : undefined,
      no: auditNo(a.audit_no), store: String(st?.location ?? '').trim(), scope: SCOPE_LABEL[a.scope] ?? a.scope, category: a.category, plan: pl?.name ?? null,
      startedOn: ct?.started_on ?? a.started_on ?? null, finishedAt: ct?.finished_at ?? null, completedOn: a.completed_on ?? null, counter: ct?.full_name ?? null, generatedAt: new Date(),
    };
  }

  private async lines(countId: number): Promise<SheetLine[]> {
    return (await this.manager.query(
      `select l.title, l.batch, to_char(l.exp_date, 'YYYY-MM-DD') as exp_date, l.pack, l.schedule, l.book_qty, l.expected_qty, l.moved_other, l.counted_qty, l.recount_qty, l.unit_cost::float as unit_cost, l.sold_since,
              (select q.status from product_qtychange q where q.count_id = l.count_id and q.item_id = l.item_id order by q.id desc limit 1) as status
         from stock_count_line l where l.count_id = $1 order by upper(l.title), l.batch`, [countId]))
      .map((l: any) => ({ ...l, status: l.status ? String(l.status).charAt(0) + String(l.status).slice(1).toLowerCase() : l.counted_qty !== null && l.counted_qty === (l.expected_qty ?? l.book_qty) ? 'Matched' : '' }));
  }

  private totals(lines: SheetLine[]): Totals {
    const v = variance(lines);
    return { lines: lines.length, counted: lines.filter((l) => l.counted_qty !== null).length, matchRate: matchRate(lines), ...v };
  }

  private pdf(buffer: Buffer, filename: string) { return { buffer, filename, contentType: 'application/pdf' }; }

  // ------------------------------------------------------------------ printed documents
  async sheet(id: number, user: any) {
    const { a } = await this.audits.access(id, user);
    if (!a.count_id) throw new BadRequestException('Start the count first: the book quantities are fixed when it starts, and the sheet is printed from them.');
    const head = await this.head(a);
    const buffer = await buildCountSheetPdf(head, await this.lines(a.count_id), false);
    await this.audit.record({ userId: user.id, action: 'stock_audit.sheet_printed', entityType: 'stock_audit', entityId: id, summary: `Count sheet ${head.no} printed`, details: {} });
    return this.pdf(buffer, `${head.no}-count-sheet.pdf`);
  }

  /** batches entered at the store while counting, which were not on the sheet */
  private async addedDuringCount(a: any, head: AuditHead) {
    if (!head.startedOn || !head.finishedAt) return [];
    const category = a.scope === 'CATEGORY' || a.scope === 'ROTATE' ? a.category : null;
    return this.manager.query(
      `select p.title, pii.batch, ((pii.qty + coalesce(pii.free_qty, 0)) * greatest(coalesce(p.pack, 1), 1))::int as units
         from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id and pi.active and not pi.archive join product p on p.id = pii.product_id
        where pii.active and not pii.archive and pii.created_on > $1 and pii.created_on <= $2 and pi.store_id = $3
          and ($4::text is null or p.category = $4) and ($6::text is distinct from 'SCHEDULE' or upper(coalesce(p.more_props->>'schedule', '')) in ('H', 'H1', 'X'))
          and not exists (select 1 from stock_count_line l where l.count_id = $5 and l.item_id = pii.id)
        order by upper(p.title), pii.batch limit 100`, [head.startedOn, head.finishedAt, a.store_id, category, a.count_id, a.scope]);
  }

  async variance(id: number, user: any) {
    const { a } = await this.audits.access(id, user);
    if (a.status !== 'DONE' || !a.count_id) throw new BadRequestException('The variance report is available once the count has been submitted.');
    const head = await this.head(a);
    const lines = await this.lines(a.count_id);
    const added = await this.addedDuringCount(a, head);
    return this.pdf(await buildVariancePdf(head, lines, this.totals(lines), added), `${head.no}-variance-report.pdf`);
  }

  async certify(id: number, body: any, user: any) {
    const { a } = await this.audits.access(id, user);
    if (a.status !== 'DONE' || !a.count_id) throw new BadRequestException('Submit the count first.');
    if (a.certified_on) throw new BadRequestException('This audit is already certified.');
    const [pend] = await this.manager.query(`select count(*)::int as n from product_qtychange q where q.count_id = $1 and coalesce(q.status, 'PENDING') = 'PENDING'`, [a.count_id]);
    if (pend.n) throw new BadRequestException(`${pend.n} adjustment${pend.n === 1 ? ' is' : 's are'} still waiting for approval. Settle them first.`);
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user.roleid || 0]);
    const who = mayCertify(a.completed_by ?? null, user.id, role?.name);
    if (!who.ok) throw new ForbiddenException('A different person from the one who counted must verify and approve the audit.');
    const head = await this.head(a);
    const lines = await this.lines(a.count_id);
    const [st] = await this.manager.query(
      `select count(*) filter (where status = 'APPROVED')::int as approved, count(*) filter (where status = 'REJECTED')::int as rejected,
              count(*) filter (where escalated)::int as escalated, count(*) filter (where escalated and recount_qty is not null)::int as recounted
         from product_qtychange where count_id = $1`, [a.count_id]);
    const [me] = await this.manager.query(`select full_name from app_user where id = $1`, [user.id]);
    const note = text(body?.note, 300);
    const certifiedOn = new Date();
    const buffer = await buildCertificatePdf({ ...head, generatedAt: certifiedOn }, {
      totals: this.totals(lines), approved: st.approved, rejected: st.rejected, pending: 0, escalated: st.escalated, recounted: st.recounted,
      countedBy: head.counter ?? '', certifiedBy: me?.full_name ?? '', certifiedOn, note, alone: who.alone,
    });
    const done = await this.manager.query(`update stock_audit set certified_on = $2, certified_by = $3, certified_note = $4 where id = $1 and certified_on is null returning id`, [id, certifiedOn, user.id, note]);
    if (!done.length) throw new BadRequestException('This audit is already certified.');
    await this.manager.query(`insert into stock_audit_document (audit_id, kind, filename, content, created_by) values ($1, 'CERTIFICATE', $2, $3, $4)`, [id, `${head.no}-certificate.pdf`, buffer, user.id]);
    await this.audit.record({ userId: user.id, action: 'stock_audit.certified', entityType: 'stock_audit', entityId: id, summary: `Stock audit ${head.no} certified`, details: { alone: who.alone, note } });
    return { id, no: head.no };
  }

  async certificate(id: number, user: any) {
    const { a } = await this.audits.access(id, user);
    const [d] = await this.manager.query(`select filename, content from stock_audit_document where audit_id = $1 and kind = 'CERTIFICATE'`, [id]);
    if (!d) throw new NotFoundException('This audit has not been certified yet.');
    return this.pdf(d.content, d.filename);
  }

  // ------------------------------------------------------------------ register and valuation
  async register(user: any, q: { year?: string; format?: string }) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const fy = financialYear(/^\d{4}$/.test(q.year ?? '') ? `${q.year}-06-01` : istDay());
    const rows = (await this.manager.query(
      `select a.id, a.audit_no, st.location as store, a.scope, a.category, to_char(a.due_on, 'YYYY-MM-DD') as due_on, a.status, to_char(a.completed_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as completed_on,
              a.lines_counted, a.lines_changed, a.variance_units, a.variance_value::float as variance_value, cb.full_name as counted_by,
              to_char(a.certified_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as certified_on, ce.full_name as certified_by
         from stock_audit a join stores st on st.id = a.store_id left join app_user cb on cb.id = a.completed_by left join app_user ce on ce.id = a.certified_by
        where a.business_id = $1 and a.status in ('DONE', 'SKIPPED') and coalesce(a.completed_on at time zone 'Asia/Kolkata', a.due_on::timestamp)::date between $2::date and $3::date
        order by a.audit_no`, [businessId, fy.start, fy.end]))
      .map((r: any) => ({ ...r, no: auditNo(r.audit_no), scope_label: SCOPE_LABEL[r.scope] ?? r.scope }));
    const done = rows.filter((r: any) => r.status === 'DONE');
    const summary = {
      audits: done.length, skipped: rows.length - done.length, certified: done.filter((r: any) => r.certified_on).length,
      uncertified: done.filter((r: any) => !r.certified_on).length, variance_value: Math.round(done.reduce((s: number, r: any) => s + (r.variance_value || 0), 0) * 100) / 100,
    };
    const years = (await this.manager.query(`select distinct extract(year from (coalesce(completed_on, due_on::timestamp) - interval '3 months'))::int as y from stock_audit where business_id = $1 order by 1 desc`, [businessId])).map((r: any) => r.y);
    if (!years.includes(fy.year)) years.unshift(fy.year);
    if (q.format === 'xlsx') return { file: await this.registerXlsx(rows, fy.label), filename: `stock-audit-register-${fy.label}.xlsx` };
    return { fy, years, rows, summary };
  }

  private async registerXlsx(rows: any[], label: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Audits ${label}`, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Audit no', key: 'no', width: 11 }, { header: 'Store', key: 'store', width: 22 }, { header: 'Covers', key: 'scope_label', width: 26 }, { header: 'Category', key: 'category', width: 18 },
      { header: 'Due', key: 'due_on', width: 12 }, { header: 'Status', key: 'status', width: 10 }, { header: 'Completed', key: 'completed_on', width: 12 },
      { header: 'Lines counted', key: 'lines_counted', width: 13 }, { header: 'Lines differed', key: 'lines_changed', width: 13 }, { header: 'Net units', key: 'variance_units', width: 10 },
      { header: 'Net value at cost', key: 'variance_value', width: 16 }, { header: 'Counted by', key: 'counted_by', width: 20 }, { header: 'Certified on', key: 'certified_on', width: 12 }, { header: 'Certified by', key: 'certified_by', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.getColumn('variance_value').numFmt = '0.00';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** book stock at cost by category as at the end of a day, for the year-end statement */
  async valuation(user: any, q: { asof?: string; storeid?: string; format?: string }) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const asof = /^\d{4}-\d{2}-\d{2}$/.test(q.asof ?? '') ? q.asof! : istDay();
    const store = /^\d+$/.test(q.storeid ?? '') ? +q.storeid! : null;
    const rows = await this.manager.query(
      `with sold as (
         select si.purchase_item_id, sum(si.qty) as q from sale_item si join sale s on s.id = si.sale_id
          where si.status = 'Complete' and si.active and not si.archive and s.bill_date < ($1::date + 1) and ($2::int is null or s.store_id = $2) group by 1
       ), adj as (
         select item_id, sum(qty) as q from product_qtychange
          where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive and created_on < ($1::date + 1) and ($2::int is null or store_id = $2) group by 1
       ), b as (
         select p.id as product_id, coalesce(nullif(btrim(p.category), ''), '(none)') as category,
                (case when $2::int is null or pi.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * p.pack else 0 end) - coalesce(s.q, 0) + coalesce(a.q, 0) as bal,
                pii.ptr_cost / nullif(p.pack, 0) as unit_cost
           from purchase_invoice_item pii
           join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive and pi.invoice_date <= $1::date
           join product p on p.id = pii.product_id and p.pack > 0
           left join sold s on s.purchase_item_id = pii.id left join adj a on a.item_id = pii.id
          where pii.active and not pii.archive)
       select category, count(distinct product_id)::int as products, sum(bal)::int as units, round(sum(bal * unit_cost)::numeric, 2)::float as value
         from b where bal > 0 group by category order by value desc`, [asof, store]);
    const total = { products: rows.reduce((s: number, r: any) => s + r.products, 0), units: rows.reduce((s: number, r: any) => s + r.units, 0), value: Math.round(rows.reduce((s: number, r: any) => s + r.value, 0) * 100) / 100 };
    if (q.format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Stock at ${asof}`);
      ws.columns = [{ header: 'Category', key: 'category', width: 30 }, { header: 'Products', key: 'products', width: 10 }, { header: 'Units', key: 'units', width: 10 }, { header: 'Value at cost', key: 'value', width: 16 }];
      ws.getRow(1).font = { bold: true };
      rows.forEach((r: any) => ws.addRow(r));
      const t = ws.addRow({ category: 'Total', ...total });
      t.font = { bold: true };
      ws.getColumn('value').numFmt = '0.00';
      wb.addWorksheet('About').addRows([[`Book stock at cost as at the end of ${asof}`], ['Quantity: bought, less sold, plus approved adjustments. Cost: purchase cost per unit including GST. The shelf count may differ until the audits are done.']]);
      return { file: Buffer.from(await wb.xlsx.writeBuffer()), filename: `stock-valuation-${asof}.xlsx` };
    }
    return { asof, rows, total };
  }

  // ------------------------------------------------------------------ standard plans
  async seedStandardPlans(user: any) {
    if (!(await this.audits.canManage(user))) throw new ForbiddenException('Only the Business Head sets up audit plans.');
    const cats = (await this.manager.query(`select distinct btrim(category) as name from product where category is not null and btrim(category) <> '' and active and not archive order by 1`)).map((r: any) => r.name);
    let created = 0;
    for (const p of standardPlans(cats, istDay())) {
      const r = await this.manager.query(
        `insert into stock_audit_plan (name, scope, categories, frequency_days, first_due, created_by)
         select $1::varchar, $2::varchar, $3::text[], $4::int, $5::date, $6::int where not exists (select 1 from stock_audit_plan where name = $1::varchar) returning id`,
        [p.name, p.scope, p.categories, p.frequency_days, p.first_due, user.id]);
      if (r.length) created++;
    }
    if (created) await this.audit.record({ userId: user.id, action: 'stock_audit.standard_plans', entityType: 'stock_audit_plan', entityId: null, summary: `${created} standard audit plan${created === 1 ? '' : 's'} added`, details: {} });
    return { created };
  }
}

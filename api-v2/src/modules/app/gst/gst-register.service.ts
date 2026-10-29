import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { GstService } from './gst.service';
import { effectiveHsn } from './gst-rate';
import { HsnLine, closeProblem, findGaps, groupHsn, hsnIssues, isMonth, monthBounds, monthIsOver, monthLabel, netByRate, parseArn, payable, sumTotals, RateTotals } from './gst-register';
import { halves, isInterState, splitBill } from './gst-tax';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The monthly GST routine (GST_SIMPLE_PLAN phase 3): the sales register (tax invoices, credit notes, cash memos and returns), the HSN summary, the monthly
 * summary against the input credit, the Excel the auditor takes, and closing a month once its return is filed.
 */
@Injectable()
export class GstRegisterService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly gst: GstService) {}

  private async ctx(user: any) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    await this.manager.query(`insert into gst_registration (business_id) values ($1) on conflict (business_id) do nothing`, [businessId]);
    const [reg] = await this.manager.query(
      `select r.reg_type, to_char(r.go_live, 'YYYY-MM-DD') as go_live, r.hsn_digits, b.name, b.legal_name, b.gstin, b.state_code
         from gst_registration r join business b on b.id = r.business_id where r.business_id = $1`, [businessId]);
    return { businessId, reg };
  }

  private month(v: any): string {
    if (!isMonth(v)) throw new BadRequestException('Choose a month (like 2026-10).');
    return v;
  }

  // ------------------------------------------------------------------ the register
  async register(user: any, monthRaw: any, storeId?: any) {
    const month = this.month(monthRaw);
    const { businessId, reg } = await this.ctx(user);
    const { from, to } = monthBounds(month);
    const store = Number(storeId) || null;
    const bills = await this.manager.query(
      `select s.id, s.bill_no, s.gst_invoice_no, to_char(s.bill_date, 'YYYY-MM-DD') as day, s.total::float8 as total, coalesce(s.disc_amount, 0)::float8 as disc,
              s.buyer_gstin, s.place_of_supply, c.name as customer, st.location as store
         from sale s join stores st on st.id = s.store_id left join customer c on c.id = s.customer_id
        where st.business_id = $1 and s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= $2::date and s.bill_date < ($3::date + 1)
          and ($4::int is null or s.store_id = $4)
        order by s.bill_date, s.id`, [businessId, from, to, store]);
    const ids = bills.map((b: any) => +b.id);
    const lines = ids.length ? await this.manager.query(
      `select sale_id, total::float8 as total, coalesce(tax_pcnt, 0)::float8 as rate from sale_item where sale_id = any($1::int[]) and active and not archive and qty > 0`, [ids]) : [];
    const byBill = new Map<number, Array<{ total: number; rate: number }>>();
    for (const l of lines) byBill.set(+l.sale_id, [...(byBill.get(+l.sale_id) || []), { total: l.total, rate: l.rate }]);

    const invoices = bills.map((b: any) => {
      const tax = !!b.gst_invoice_no;
      const inter = tax && isInterState(b.place_of_supply, reg.state_code);
      const rates = tax ? splitBill(byBill.get(+b.id) || [], b.disc, inter) : [];
      return {
        id: +b.id, kind: tax ? 'TAX' : 'CASH', doc_no: tax ? b.gst_invoice_no : String(b.bill_no ?? b.id), bill_no: b.bill_no, date: b.day, customer: b.customer || 'Walk-in',
        buyer_gstin: b.buyer_gstin, place_of_supply: b.place_of_supply, store: b.store, total: r2(b.total), discount: r2(b.disc), inter_state: inter, rates,
      };
    });

    const notes = await this.manager.query(
      `select cn.note_no, to_char(cn.note_date, 'YYYY-MM-DD') as day, cn.original_invoice_no, to_char(cn.original_invoice_date, 'YYYY-MM-DD') as original_day, cn.rate::float8 as rate, cn.qty,
              cn.gross::float8 as gross, cn.taxable::float8 as taxable, cn.tax::float8 as tax, cn.place_of_supply, cn.buyer_gstin, st.location as store
         from gst_credit_note cn join sale s on s.id = cn.sale_id join stores st on st.id = s.store_id
        where cn.business_id = $1 and cn.note_date >= $2::date and cn.note_date <= $3::date and ($4::int is null or s.store_id = $4) order by cn.note_date, cn.id`, [businessId, from, to, store]);
    const credit_notes = notes.map((n: any) => {
      const inter = isInterState(n.place_of_supply, reg.state_code);
      const h = inter ? { cgst: 0, sgst: 0 } : halves(n.tax);
      return { note_no: n.note_no, date: n.day, original_invoice_no: n.original_invoice_no, original_date: n.original_day, rate: n.rate, qty: n.qty, gross: r2(n.gross), taxable: r2(n.taxable),
        cgst: h.cgst, sgst: h.sgst, igst: inter ? r2(n.tax) : 0, tax: r2(n.tax), place_of_supply: n.place_of_supply, buyer_gstin: n.buyer_gstin, store: n.store };
    });

    const cashReturns = await this.manager.query(
      `select to_char(ri.settled_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day, s.bill_no, p.title as product, coalesce(ri.accepted_qty, ri.qty) as qty,
              coalesce(ri.refund_amount, si.total / nullif(si.qty, 0) * coalesce(ri.accepted_qty, ri.qty))::float8 as amount
         from sale_return_item ri join sale_item si on si.id = ri.sale_item_id join sale s on s.id = si.sale_id join stores st on st.id = s.store_id join product p on p.id = si.product_id
        where st.business_id = $1 and upper(ri.status) = 'ADJUSTED' and s.gst_invoice_no is null
          and (ri.settled_on at time zone 'Asia/Kolkata')::date >= $2::date and (ri.settled_on at time zone 'Asia/Kolkata')::date <= $3::date and ($4::int is null or s.store_id = $4)
        order by ri.settled_on`, [businessId, from, to, store]);
    const returns_cash = cashReturns.map((r: any) => ({ date: r.day, bill_no: r.bill_no, product: r.product, qty: Number(r.qty), amount: r2(r.amount) }));

    const taxInvoices = invoices.filter((i: any) => i.kind === 'TAX');
    const invRates: RateTotals[] = taxInvoices.flatMap((i: any) => i.rates.map((r: any) => ({ rate: r.rate, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, tax: r.tax })));
    const cnRates: RateTotals[] = credit_notes.map((c: any) => ({ rate: c.rate, taxable: c.taxable, cgst: c.cgst, sgst: c.sgst, igst: c.igst, tax: c.tax }));
    const net = netByRate(invRates, cnRates);
    const cash = invoices.filter((i: any) => i.kind === 'CASH');
    return {
      month, label: monthLabel(month), from, to, registered: reg.reg_type === 'registered', gstin: reg.gstin, state_code: reg.state_code, business: reg.legal_name || reg.name,
      invoices, credit_notes, returns_cash,
      gaps: findGaps(taxInvoices.map((i: any) => i.doc_no)),
      totals: {
        tax_invoices: taxInvoices.length, tax_invoice_total: r2(taxInvoices.reduce((t: number, i: any) => t + i.total, 0)),
        credit_notes: credit_notes.length, credit_note_total: r2(credit_notes.reduce((t: number, c: any) => t + c.gross, 0)),
        cash_bills: cash.length, cash_total: r2(cash.reduce((t: number, i: any) => t + i.total, 0)),
        cash_returns: returns_cash.length, cash_returns_total: r2(returns_cash.reduce((t: number, r: any) => t + r.amount, 0)),
        output: sumTotals(netByRate(invRates, [])), credits: sumTotals(netByRate([], cnRates).map((r) => ({ ...r, taxable: -r.taxable, cgst: -r.cgst, sgst: -r.sgst, igst: -r.igst, tax: -r.tax }))),
        net_by_rate: net, net: sumTotals(net),
      },
    };
  }

  // ------------------------------------------------------------------ the HSN summary
  async hsn(user: any, monthRaw: any) {
    const month = this.month(monthRaw);
    const { businessId, reg } = await this.ctx(user);
    const [closed] = await this.manager.query(`select hsn_snapshot from gst_filing_month where business_id = $1 and month = $2 and status = 'CLOSED'`, [businessId, month]);
    if (closed?.hsn_snapshot) return { month, snapshot: true, ...closed.hsn_snapshot };
    const { from, to } = monthBounds(month);
    const sold = await this.manager.query(
      `with bills as (
         select s.id, coalesce(s.disc_amount, 0)::float8 as disc, (select coalesce(sum(x.total), 0)::float8 from sale_item x where x.sale_id = s.id and x.active and not x.archive and x.qty > 0) as lines_total
           from sale s join stores st on st.id = s.store_id
          where st.business_id = $1 and s.status = 'COMPLETE' and s.active and not s.archive and s.gst_invoice_no is not null and s.bill_date >= $2::date and s.bill_date < ($3::date + 1))
       select p.id as product_id, p.title, p.category, nullif(btrim(p.hsn_code), '') as hsn, d.hsn as category_hsn, si.qty::float8 as qty, coalesce(si.tax_pcnt, 0)::float8 as rate,
              (si.total * (1 - least(b.disc, b.lines_total) / nullif(b.lines_total, 0)))::float8 as net_gross
         from bills b join sale_item si on si.sale_id = b.id and si.active and not si.archive and si.qty > 0 join product p on p.id = si.product_id
         left join category_hsn_default d on lower(d.category) = lower(btrim(coalesce(p.category, '')))`, [businessId, from, to]);
    const credits = await this.manager.query(
      `select p.id as product_id, p.title, p.category, nullif(btrim(p.hsn_code), '') as hsn, d.hsn as category_hsn, cn.qty::float8 as qty, cn.rate::float8 as rate, cn.taxable::float8 as taxable, cn.tax::float8 as tax
         from gst_credit_note cn join sale_item si on si.id = cn.sale_item_id join product p on p.id = si.product_id
         left join category_hsn_default d on lower(d.category) = lower(btrim(coalesce(p.category, '')))
        where cn.business_id = $1 and cn.note_date >= $2::date and cn.note_date <= $3::date`, [businessId, from, to]);
    const facts = (r: any) => ({ id: +r.product_id, category: r.category, hsn: r.hsn, categoryHsn: r.category_hsn });
    const lines: HsnLine[] = [];
    for (const r of sold) {
      const e = effectiveHsn(facts(r));
      const gross = Number(r.net_gross) || 0, taxable = gross / (1 + r.rate / 100);
      lines.push({ hsn: e.hsn, source: e.source, rate: r.rate, qty: r.qty, taxable, tax: gross - taxable, product: r.title });
    }
    for (const r of credits) {
      const e = effectiveHsn(facts(r));
      lines.push({ hsn: e.hsn, source: e.source, rate: r.rate, qty: -r.qty, taxable: -r.taxable, tax: -r.tax, product: r.title });
    }
    const rows = groupHsn(lines);
    return { month, snapshot: false, rows, issues: hsnIssues(rows, reg.hsn_digits || 4), digits: reg.hsn_digits || 4 };
  }

  // ------------------------------------------------------------------ the monthly summary
  async summary(user: any, monthRaw: any) {
    const month = this.month(monthRaw);
    const { businessId, reg } = await this.ctx(user);
    const reg1 = await this.register(user, month);
    const hsn = await this.hsn(user, month);
    let itc: any = null;
    try { itc = await this.gst.summary(businessId, month); } catch { itc = null; }
    const claimable = r2(itc?.itc_claimable ?? 0);
    const out = reg1.totals.net.tax;
    const p = payable(out, claimable);
    const [row] = await this.manager.query(
      `select to_char(filed_on, 'YYYY-MM-DD') as filed_on, arn, accepted_hsn, to_char(closed_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as closed_on, status from gst_filing_month where business_id = $1 and month = $2`, [businessId, month]);
    return {
      month, label: monthLabel(month), registered: reg.reg_type === 'registered',
      output_by_rate: reg1.totals.net_by_rate, output: reg1.totals.net,
      itc: { claimable, on_hold: r2((itc?.itc_on_hold ?? 0)), carried_forward: r2(itc?.itc_carried_forward ?? 0), matched: itc?.matched?.count ?? 0, mismatch: itc?.mismatch?.count ?? 0, missing_in_2b: itc?.missing_in_2b?.count ?? 0, reconciled: !!itc },
      payable: p.payable, carry_forward: p.carry_forward,
      issues: { hsn: hsn.issues, gaps: reg1.gaps },
      counts: { tax_invoices: reg1.totals.tax_invoices, credit_notes: reg1.totals.credit_notes, cash_bills: reg1.totals.cash_bills, cash_total: reg1.totals.cash_total, cash_returns_total: reg1.totals.cash_returns_total },
      closed: row?.status === 'CLOSED' ? { filed_on: row.filed_on, arn: row.arn, accepted_hsn: row.accepted_hsn, closed_on: row.closed_on } : null,
    };
  }

  // ------------------------------------------------------------------ the months
  async months(user: any) {
    const { businessId, reg } = await this.ctx(user);
    const today = istDay();
    const rows = await this.manager.query(`select month, status, to_char(filed_on, 'YYYY-MM-DD') as filed_on, arn, accepted_hsn from gst_filing_month where business_id = $1`, [businessId]);
    const closed = new Map<string, any>(rows.filter((r: any) => r.status === 'CLOSED').map((r: any) => [r.month, r]));
    const counts = await this.manager.query(
      `select to_char(s.bill_date, 'YYYY-MM') as month, count(*) filter (where s.gst_invoice_no is not null)::int as invoices, count(*)::int as bills
         from sale s join stores st on st.id = s.store_id where st.business_id = $1 and s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= ($2::date - 430) group by 1`, [businessId, today]);
    const cnt = new Map<string, any>(counts.map((c: any) => [c.month, c]));
    const out: any[] = [];
    let y = +today.slice(0, 4), m = +today.slice(5, 7);
    for (let i = 0; i < 14; i++) {
      const month = `${y}-${String(m).padStart(2, '0')}`;
      const c = closed.get(month), k = cnt.get(month);
      const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
      out.push({
        month, label: monthLabel(month), over: monthIsOver(month, today), invoices: k?.invoices ?? 0, bills: k?.bills ?? 0,
        closed: !!c, filed_on: c?.filed_on ?? null, arn: c?.arn ?? null,
        can_close: reg.reg_type === 'registered' && !!reg.go_live && monthIsOver(month, today) && month >= reg.go_live.slice(0, 7) && !c,
        due_gstr1: `${next.y}-${String(next.m).padStart(2, '0')}-11`, due_gstr3b: `${next.y}-${String(next.m).padStart(2, '0')}-20`,
      });
      m--; if (m === 0) { m = 12; y--; }
    }
    return { registered: reg.reg_type === 'registered', months: out };
  }

  async close(user: any, monthRaw: any, body: any) {
    const month = this.month(monthRaw);
    const { businessId, reg } = await this.ctx(user);
    const [have] = await this.manager.query(`select status from gst_filing_month where business_id = $1 and month = $2`, [businessId, month]);
    const early = closeProblem({ registered: reg.reg_type === 'registered', goLive: reg.go_live, month, today: istDay(), alreadyClosed: have?.status === 'CLOSED', issues: { unknown_rows: 0, provisional_rows: 0, short_rows: 0, digits: 4 }, acceptHsn: true });
    if (early) throw new BadRequestException(early);
    const arn = parseArn(body?.arn);
    if (arn.error) throw new BadRequestException(arn.error);
    let filedOn: string | null = body?.filed_on ? String(body.filed_on) : null;
    if (filedOn && !/^\d{4}-\d{2}-\d{2}$/.test(filedOn)) throw new BadRequestException('Give the date it was filed as a date.');
    const summary = await this.summary(user, month);
    const hsn = await this.hsn(user, month);
    const hi = summary.issues.hsn;
    const problem = closeProblem({ registered: true, goLive: reg.go_live, month, today: istDay(), alreadyClosed: false, issues: hi, acceptHsn: body?.accept_hsn === true });
    if (problem) throw new BadRequestException(problem);
    await this.manager.query(
      `insert into gst_filing_month (business_id, month, status, filed_on, arn, accepted_hsn, hsn_snapshot, summary_snapshot, closed_by, closed_on)
       values ($1, $2, 'CLOSED', $3, $4, $5, $6::jsonb, $7::jsonb, $8, now())
       on conflict (business_id, month) do update set status = 'CLOSED', filed_on = excluded.filed_on, arn = excluded.arn, accepted_hsn = excluded.accepted_hsn, hsn_snapshot = excluded.hsn_snapshot,
         summary_snapshot = excluded.summary_snapshot, closed_by = excluded.closed_by, closed_on = now(), reopened_by = null, reopened_on = null, reopen_reason = null`,
      [businessId, month, filedOn, arn.value, body?.accept_hsn === true, JSON.stringify({ rows: hsn.rows, issues: hsn.issues, digits: hsn.digits }), JSON.stringify(summary), user.id]);
    await this.audit.record({
      userId: user.id, action: 'gst.month_closed', entityType: 'gst_filing_month', entityId: businessId,
      summary: `${monthLabel(month)} closed${arn.value ? `, ARN ${arn.value}` : ''}${body?.accept_hsn === true && !hi.clean ? ', HSN accepted as it stands' : ''}`,
      details: { month, arn: arn.value, filed_on: filedOn, accepted_hsn: body?.accept_hsn === true, issues: hi, output: summary.output, itc: summary.itc },
    });
    return this.months(user);
  }

  async reopen(user: any, monthRaw: any, body: any) {
    const month = this.month(monthRaw);
    const { businessId } = await this.ctx(user);
    const reason = String(body?.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('Say why the month is reopened.');
    const res = await this.manager.query(
      `update gst_filing_month set status = 'OPEN', reopened_by = $3, reopened_on = now(), reopen_reason = $4 where business_id = $1 and month = $2 and status = 'CLOSED' returning month`, [businessId, month, user.id, reason.slice(0, 300)])
      .then((r: any) => (Array.isArray(r[0]) ? r[0] : r));
    if (!res.length) throw new BadRequestException('That month is not closed.');
    await this.audit.record({ userId: user.id, action: 'gst.month_reopened', entityType: 'gst_filing_month', entityId: businessId, summary: `${monthLabel(month)} reopened: ${reason}`, details: { month, reason } });
    return this.months(user);
  }

  // ------------------------------------------------------------------ Excel
  private head(ws: ExcelJS.Worksheet) { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]; }

  private salesSheet(wb: ExcelJS.Workbook, reg: any) {
    const ws = wb.addWorksheet('Sales and returns');
    ws.columns = [
      { header: 'Type', key: 'type', width: 16 }, { header: 'Number', key: 'no', width: 18 }, { header: 'Date', key: 'date', width: 12 }, { header: 'Customer', key: 'customer', width: 24 },
      { header: 'Buyer GSTIN', key: 'gstin', width: 17 }, { header: 'Place of supply', key: 'pos', width: 8 }, { header: 'GST %', key: 'rate', width: 7 },
      { header: 'Taxable value', key: 'taxable', width: 13 }, { header: 'CGST', key: 'cgst', width: 10 }, { header: 'SGST', key: 'sgst', width: 10 }, { header: 'IGST', key: 'igst', width: 10 },
      { header: 'Total', key: 'total', width: 13 }, { header: 'Against invoice', key: 'orig', width: 18 }, { header: 'Store', key: 'store', width: 16 },
    ];
    this.head(ws);
    for (const i of reg.invoices) {
      if (i.kind === 'TAX') {
        for (const r of i.rates) ws.addRow({ type: 'Tax invoice', no: i.doc_no, date: i.date, customer: i.customer, gstin: i.buyer_gstin, pos: i.place_of_supply, rate: r.rate, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, total: r2(r.taxable + r.tax), store: i.store });
        if (!i.rates.length) ws.addRow({ type: 'Tax invoice', no: i.doc_no, date: i.date, customer: i.customer, total: i.total, store: i.store });
      } else {
        ws.addRow({ type: 'Cash memo', no: i.doc_no, date: i.date, customer: i.customer, total: i.total, store: i.store });
      }
    }
    for (const c of reg.credit_notes) ws.addRow({ type: 'Credit note', no: c.note_no, date: c.date, gstin: c.buyer_gstin, pos: c.place_of_supply, rate: c.rate, taxable: -c.taxable, cgst: -c.cgst, sgst: -c.sgst, igst: -c.igst, total: -c.gross, orig: c.original_invoice_no, store: c.store });
    for (const r of reg.returns_cash) ws.addRow({ type: 'Return (cash memo)', no: `Bill ${r.bill_no}`, date: r.date, customer: r.product, total: -r.amount });
    const t = reg.totals;
    ws.addRow({});
    const bold = (label: string, v: any) => { const row = ws.addRow({ type: label, ...v }); row.font = { bold: true }; };
    bold('Tax invoices', { taxable: t.output.taxable, cgst: t.output.cgst, sgst: t.output.sgst, igst: t.output.igst, total: r2(t.output.taxable + t.output.tax) });
    bold('Credit notes', { taxable: -t.credits.taxable, cgst: -t.credits.cgst, sgst: -t.credits.sgst, igst: -t.credits.igst, total: -t.credit_note_total });
    bold('Net tax documents', { taxable: t.net.taxable, cgst: t.net.cgst, sgst: t.net.sgst, igst: t.net.igst, total: r2(t.net.taxable + t.net.tax) });
    bold('Cash memos', { total: t.cash_total });
    bold('Returns of cash memos', { total: -t.cash_returns_total });
    return ws;
  }

  async salesXlsx(user: any, month: any) {
    const reg = await this.register(user, month);
    const wb = new ExcelJS.Workbook();
    this.salesSheet(wb, reg);
    await this.audit.record({ userId: user.id, action: 'gst.sales_exported', entityType: 'gst_filing_month', entityId: null, summary: `Sales and returns for ${reg.label} exported`, details: { month: reg.month } });
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `sales-and-returns-${reg.month}.xlsx`, contentType: XLSX };
  }

  /** the auditor's pack: the sales and returns first, then the HSN summary, the monthly summary, the purchases and the reconciliation */
  async pack(user: any, monthRaw: any) {
    const month = this.month(monthRaw);
    const { businessId, reg: r } = await this.ctx(user);
    const reg = await this.register(user, month);
    const sum = await this.summary(user, month);
    const hsn = await this.hsn(user, month);
    const wb = new ExcelJS.Workbook();

    const cover = wb.addWorksheet('Cover');
    cover.columns = [{ width: 34 }, { width: 60 }];
    const kv = (k: string, v: any, bold = false) => { const row = cover.addRow([k, v]); if (bold) row.font = { bold: true }; };
    kv('GST records pack', '', true);
    kv('Business', reg.business); kv('GSTIN', reg.gstin || '(not registered)'); kv('Month', reg.label);
    kv('Registration', reg.registered ? 'Registered and filing' : 'Not registered');
    kv('Made on', istDay());
    cover.addRow([]);
    kv('Tax invoices', sum.counts.tax_invoices); kv('Credit notes', sum.counts.credit_notes); kv('Cash memos', `${sum.counts.cash_bills} (${sum.counts.cash_total})`);
    kv('Output tax, net of credit notes', sum.output.tax); kv('Input credit claimable (reconciled)', sum.itc.claimable);
    kv(sum.payable > 0 ? 'Tax payable' : 'Credit to carry forward', sum.payable > 0 ? sum.payable : sum.carry_forward, true);
    cover.addRow([]);
    if (sum.closed) kv('Filed', `${sum.closed.filed_on || ''} ${sum.closed.arn ? 'ARN ' + sum.closed.arn : ''}`.trim());
    const hi = sum.issues.hsn;
    if (!hi.clean) kv('HSN to check', `${hi.unknown_rows} with no HSN, ${hi.provisional_rows} on a provisional category code, ${hi.short_rows} shorter than ${hi.digits} digits`);
    if (sum.issues.gaps.length) kv('Gaps in the invoice numbers', sum.issues.gaps.join(', '));
    if (!sum.itc.reconciled) kv('Note', 'No GSTR-2B has been loaded for this month, so no input credit is counted.');

    this.salesSheet(wb, reg);

    const hs = wb.addWorksheet('HSN summary');
    hs.columns = [{ header: 'HSN', key: 'hsn', width: 12 }, { header: 'Status', key: 'status', width: 14 }, { header: 'GST %', key: 'rate', width: 8 }, { header: 'Quantity', key: 'qty', width: 10 }, { header: 'Taxable value', key: 'taxable', width: 14 }, { header: 'Tax', key: 'tax', width: 12 }, { header: 'Products', key: 'products', width: 9 }];
    this.head(hs);
    hsn.rows.forEach((x: any) => hs.addRow({ hsn: x.hsn || 'not known', status: x.source === 'own' ? 'own' : x.source === 'category' ? 'provisional' : 'unknown', rate: x.rate, qty: x.qty, taxable: x.taxable, tax: x.tax, products: x.products }));

    const ss = wb.addWorksheet('Summary');
    ss.columns = [{ header: 'GST %', key: 'rate', width: 8 }, { header: 'Taxable value', key: 'taxable', width: 14 }, { header: 'CGST', key: 'cgst', width: 11 }, { header: 'SGST', key: 'sgst', width: 11 }, { header: 'IGST', key: 'igst', width: 11 }, { header: 'Tax', key: 'tax', width: 11 }];
    this.head(ss);
    sum.output_by_rate.forEach((x: any) => ss.addRow(x));
    ss.addRow({ rate: 'Total', ...sum.output }).font = { bold: true };

    const { from, to } = monthBounds(month);
    const pur = await this.manager.query(
      `select pi.invoice_no, to_char(pi.invoice_date, 'YYYY-MM-DD') as day, v.business_name as vendor, coalesce(pi.supplier_gstin, v.gstn) as gstin, coalesce(pi.taxable_value, 0)::float8 as taxable,
              coalesce(pi.cgst_amount, 0)::float8 as cgst, coalesce(pi.sgst_amount, 0)::float8 as sgst, coalesce(pi.igst_amount, 0)::float8 as igst, coalesce(pi.total, 0)::float8 as total,
              coalesce(pi.reverse_charge, false) as rcm, pi.gst_recon_status as recon
         from purchase_invoice pi join vendor v on v.id = pi.vendor_id
        where pi.active and not pi.archive and pi.status = 'COMPLETE' and pi.invoice_date >= $1::date and pi.invoice_date <= $2::date order by pi.invoice_date, pi.id`, [from, to]);
    const ps = wb.addWorksheet('Purchases');
    ps.columns = [{ header: 'Invoice', key: 'invoice_no', width: 16 }, { header: 'Date', key: 'day', width: 12 }, { header: 'Vendor', key: 'vendor', width: 28 }, { header: 'Vendor GSTIN', key: 'gstin', width: 17 },
      { header: 'Taxable value', key: 'taxable', width: 13 }, { header: 'CGST', key: 'cgst', width: 10 }, { header: 'SGST', key: 'sgst', width: 10 }, { header: 'IGST', key: 'igst', width: 10 }, { header: 'Total', key: 'total', width: 12 },
      { header: 'Reverse charge', key: 'rcm', width: 9 }, { header: 'Reconciliation', key: 'recon', width: 16 }];
    this.head(ps);
    pur.forEach((x: any) => ps.addRow({ ...x, rcm: x.rcm ? 'yes' : '' }));

    const rec = await this.manager.query(
      `select r.status, r.match_type, pi.invoice_no as books_invoice, gi.invoice_no as portal_invoice, coalesce(gi.supplier_gstin, pi.supplier_gstin) as gstin,
              (coalesce(pi.cgst_amount, 0) + coalesce(pi.sgst_amount, 0) + coalesce(pi.igst_amount, 0))::float8 as books_itc, (coalesce(gi.cgst, 0) + coalesce(gi.sgst, 0) + coalesce(gi.igst, 0))::float8 as portal_itc
         from gst_reconciliation r left join purchase_invoice pi on pi.id = r.purchase_invoice_id left join gst_inward_supply gi on gi.id = r.inward_supply_id
        where r.business_id = $1 and r.period = $2 and r.active order by r.status, pi.invoice_no`, [businessId, month]);
    const rs = wb.addWorksheet('Reconciliation');
    rs.columns = [{ header: 'Status', key: 'status', width: 18 }, { header: 'Match', key: 'match_type', width: 12 }, { header: 'Books invoice', key: 'books_invoice', width: 16 }, { header: 'Portal invoice', key: 'portal_invoice', width: 16 },
      { header: 'Supplier GSTIN', key: 'gstin', width: 17 }, { header: 'ITC in books', key: 'books_itc', width: 12 }, { header: 'ITC on portal', key: 'portal_itc', width: 12 }];
    this.head(rs);
    rec.forEach((x: any) => rs.addRow(x));

    await this.audit.record({ userId: user.id, action: 'gst.pack_exported', entityType: 'gst_filing_month', entityId: null, summary: `GST records pack for ${reg.label} exported`, details: { month } });
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `gst-records-pack-${month}.xlsx`, contentType: XLSX };
  }
}

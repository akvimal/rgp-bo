import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { affectedRows } from 'src/core/db-result';
import { permsOf } from 'src/core/role-rules';
import { PurchasingAction, canDoPurchasing } from './purchasing-access';
import { ApprovalPolicy, loadApprovalPolicy } from './invoice-approval';

export const INVOICE_VIEWS = ['all', 'pending', 'overdue', 'due7', 'hold', 'paid', 'draft', 'awaiting', 'approval', 'ready', 'ready_overdue', 'ready_due7', 'ready_later', 'notready'] as const;
export type InvoiceView = typeof INVOICE_VIEWS[number];

/** `since`: the usual window (for example the last year): invoices dated before it are left out unless something is still owed on them or they are not received yet */
export interface InvoiceFilter {
  vendor?: number; from?: string; to?: string; since?: string; q?: string; product?: string;
  /** when it falls due: overdue, within 7 days, or later */
  due?: 'overdue' | 'due7' | 'later';
  /** the day it was marked ready for payment, from and to */
  readyfrom?: string; readyto?: string;
  /** the invoice amount, from and to */
  min?: number; max?: number;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// sortable columns -> SQL (all from the wrapped query below)
const SORTS: Record<string, string> = {
  invoice_date: 'invoice_date', due_date: 'due_date', total: 'total', paid_amount: 'paid', balance_amount: 'balance',
  business_name: 'lower(business_name)', invoice_no: 'coalesce(invoice_no, challan_no)', payment_status: 'payment_status', items: 'items', ready_on: 'ready_on',
};

/**
 * Purchase invoices as the person who pays them sees them: what is pending, what is overdue, what falls due this
 * week, what is on hold, what is paid, and what is still only a draft (not received, so never owed). Balances come
 * from the payments recorded against each invoice, the same arithmetic as the Outstanding and Payables screens.
 */
@Injectable()
export class InvoiceViewService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
  ) {}

  /** recent, or still to be dealt with: an old invoice stays in the list while something is owed on it, or while it is a draft or waiting for the vendor's invoice */
  private sinceSql(): string {
    return `(i.invoice_date >= ?::date or i.status <> 'COMPLETE' or i.invoice_no is null
             or i.total::numeric - coalesce((select sum(vp.amount) from vendor_payment vp where vp.invoice_id = i.id), 0)::numeric > 0.005)`;
  }

  /** the vendors that have an invoice in the same date window (not narrowed by the vendor, the search words or the view), for the vendor filter */
  async vendors(f: InvoiceFilter) {
    const where: string[] = ['i.active and not i.archive'];
    const args: any[] = [];
    const add = (sql: string, v: any) => { args.push(v); where.push(sql.split('?').join(`$${args.length}`)); };
    if (f.from && DATE.test(f.from)) add('i.invoice_date >= ?::date', f.from);
    if (f.to && DATE.test(f.to)) add('i.invoice_date <= ?::date', f.to);
    if (f.since && DATE.test(f.since)) add(this.sinceSql(), f.since);
    return this.manager.query(
      `select v.id, v.business_name as name, case when not v.active then 'DISABLED' when v.blocked then 'BLOCKED' else 'ACTIVE' end as status
         from vendor v where v.id in (select i.vendor_id from purchase_invoice i where ${where.join(' and ')})
        order by lower(v.business_name)`, args);
  }

  /** Shared SELECT: one row per invoice with paid, balance and the derived flags. Filters are bound parameters. */
  private base(f: InvoiceFilter, policy: ApprovalPolicy) {
    const where: string[] = ['i.active and not i.archive'];
    const args: any[] = [];
    const add = (sql: string, v: any) => { args.push(v); where.push(sql.split('?').join(`$${args.length}`)); };
    if (f.vendor) add('i.vendor_id = ?', f.vendor);
    if (f.from && DATE.test(f.from)) add('i.invoice_date >= ?::date', f.from);
    if (f.to && DATE.test(f.to)) add('i.invoice_date <= ?::date', f.to);
    if (f.since && DATE.test(f.since)) add(this.sinceSql(), f.since);
    if (f.q && f.q.trim()) add(`(i.invoice_no ilike ? or i.challan_no ilike ?)`, `%${f.q.trim()}%`);
    // when it falls due, the day it was marked ready, and how much it is
    if (f.due === 'overdue') where.push(`coalesce(i.due_date, i.invoice_date) < current_date`);
    if (f.due === 'due7') where.push(`coalesce(i.due_date, i.invoice_date) >= current_date and coalesce(i.due_date, i.invoice_date) <= current_date + 7`);
    if (f.due === 'later') where.push(`coalesce(i.due_date, i.invoice_date) > current_date + 7`);
    if (f.readyfrom && DATE.test(f.readyfrom)) add(`(i.payment_ready_on at time zone 'Asia/Kolkata')::date >= ?::date`, f.readyfrom);
    if (f.readyto && DATE.test(f.readyto)) add(`(i.payment_ready_on at time zone 'Asia/Kolkata')::date <= ?::date`, f.readyto);
    if (Number.isFinite(f.min as number) && (f.min as number) >= 0) add(`i.total::numeric >= ?`, f.min);
    if (Number.isFinite(f.max as number) && (f.max as number) > 0) add(`i.total::numeric <= ?`, f.max);
    // invoices that have a line for a product whose name contains the text
    if (f.product && f.product.trim()) add(`exists (select 1 from purchase_invoice_item x join product p on p.id = x.product_id where x.invoice_id = i.id and x.active and not x.archive and p.title ilike ?)`, `%${f.product.trim()}%`);
    const sql = `
      select w.*,
             greatest(w.total - w.paid, 0) as balance,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005) as pending,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status = 'On Hold') as on_hold,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.due_date < current_date) as overdue,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.due_date >= current_date and w.due_date <= current_date + 7) as due7,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid <= 0.005) as is_paid,
             (w.status <> 'COMPLETE') as draft,
             (w.status = 'COMPLETE' and w.invoice_no is null) as awaiting,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.needs_appr and w.ready_on is not null) as awaiting_approval,
             -- completed and owed, but nobody has said it is ready for payment yet
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.ready_on is null) as not_ready,
             -- what can be paid now: owed, not on hold and not waiting for approval; split by when it falls due, so every one of them is counted once
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and not w.needs_appr and w.ready_on is not null) as ready,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and not w.needs_appr and w.ready_on is not null and w.due_date < current_date) as ready_overdue,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and not w.needs_appr and w.ready_on is not null and w.due_date >= current_date and w.due_date <= current_date + 7) as ready_due7,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and not w.needs_appr and w.ready_on is not null and w.due_date > current_date + 7) as ready_later,
             case when w.status <> 'COMPLETE' then 'Draft'
                  when w.invoice_no is null then 'Awaiting invoice'
                  when w.total - w.paid <= 0.005 then 'Paid'
                  when w.stored_status = 'On Hold' then 'On Hold'
                  when w.ready_on is null then 'Not ready'
                  when w.needs_appr then 'Awaiting approval'
                  when w.paid > 0.005 then 'Part Paid'
                  else 'Unpaid' end as payment_status,
             case when w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.due_date < current_date
                  then (current_date - w.due_date) else 0 end as days_overdue,
             case when w.status = 'COMPLETE' and w.invoice_no is null then (current_date - coalesce(w.challan_date, w.invoice_date)) else 0 end as days_waiting
        from (
          select i.id, i.vendor_id, btrim(v.business_name) as business_name, i.invoice_no, i.challan_no, i.challan_date, i.invoice_date,
                 coalesce(i.due_date, i.invoice_date) as due_date, i.status, i.total::numeric as total,
                 coalesce(i.payment_status, 'Unpaid') as stored_status, coalesce(gr.status, i.gst_recon_status) as gst_recon_status, i.gst_period,
                 i.hold_reason, i.approved_on, i.approval_note, ua.full_name as approved_by_name,
                 i.payment_ready_on as ready_on, i.payment_ready_note as ready_note, ur.full_name as ready_by_name, (i.payment_ready_by is not null) as ready_marked,
                 (${policy.enabled ? 'true' : 'false'} and i.approved_on is null and (${Number(policy.limit) || 0} <= 0 or i.total::numeric > ${Number(policy.limit) || 0})) as needs_appr,
                 p.paid, p.last_payment, p.payments,
                 (select count(*) from purchase_invoice_item x where x.invoice_id = i.id)::int as items
            from purchase_invoice i
            join vendor v on v.id = i.vendor_id
            left join app_user ua on ua.id = i.approved_by
            left join app_user ur on ur.id = i.payment_ready_by
            left join lateral (select r.status from gst_reconciliation r where r.purchase_invoice_id = i.id and r.active and not r.archive order by r.id desc limit 1) gr on true
            left join lateral (select coalesce(sum(amount), 0)::numeric as paid, max(pay_date) filter (where amount > 0) as last_payment,
                                      (count(*) filter (where amount > 0))::int as payments
                                 from vendor_payment where invoice_id = i.id) p on true
           where ${where.join(' and ')}
        ) w`;
    return { sql, args };
  }

  private viewClause(view: string): string {
    switch (view) {
      case 'pending': return 'pending';
      case 'overdue': return 'overdue';
      case 'due7': return 'due7';
      case 'hold': return 'on_hold';
      case 'paid': return 'is_paid';
      case 'draft': return 'draft';
      case 'awaiting': return 'awaiting';
      case 'approval': return 'awaiting_approval';
      case 'ready': return 'ready';
      case 'ready_overdue': return 'ready_overdue';
      case 'ready_due7': return 'ready_due7';
      case 'ready_later': return 'ready_later';
      case 'notready': return 'not_ready';
      default: return 'true';
    }
  }

  async search(f: InvoiceFilter, view: string, sort: string | undefined, dir: string | undefined, page = 1, limit = 25) {
    const { sql, args } = this.base(f, await loadApprovalPolicy(this.manager));
    const v = (INVOICE_VIEWS as readonly string[]).includes(view) ? view : 'all';
    // unpaid views read best oldest-due first; the rest newest first
    const defaultSort = ['pending', 'overdue', 'due7', 'hold', 'approval', 'ready', 'ready_overdue', 'ready_due7', 'ready_later', 'notready'].includes(v) ? 'due_date asc' : v === 'awaiting' ? 'invoice_date asc' : 'invoice_date desc';
    const col = sort && SORTS[sort] ? `${SORTS[sort]} ${dir === 'asc' ? 'asc' : 'desc'}, id desc` : `${defaultSort}, id desc`;
    const safeLimit = Math.min(100, Math.max(1, limit || 25));
    const safePage = Math.max(1, page || 1);
    const rows = await this.manager.query(
      `select *, count(*) over ()::int as total_rows from (${sql}) x where ${this.viewClause(v)}
        order by ${col} limit ${safeLimit} offset ${(safePage - 1) * safeLimit}`, args);
    const data = rows.map((r: any) => ({
      id: r.id, vendor_id: r.vendor_id, business_name: r.business_name, invoice_no: r.invoice_no, challan_no: r.challan_no, challan_date: r.challan_date,
      awaiting: r.awaiting, days_waiting: +r.days_waiting,
      invoice_date: r.invoice_date, due_date: r.due_date, status: r.status, payment_status: r.payment_status,
      items: r.items, total: +r.total, paid_amount: +r.paid, balance_amount: +r.balance, days_overdue: +r.days_overdue,
      last_payment: r.last_payment, payments: r.payments, on_hold: r.on_hold, hold_reason: r.hold_reason,
      gst_status: r.gst_recon_status, gst_period: r.gst_period,
      payment_ready: !!r.ready_on, ready_marked: !!r.ready_marked, ready_on: r.ready_on, ready_by: r.ready_by_name, ready_note: r.ready_note, not_ready: r.not_ready,
      awaiting_approval: r.awaiting_approval, approved: !!r.approved_on, approved_on: r.approved_on, approved_by: r.approved_by_name, approval_note: r.approval_note,
    }));
    return { data, total: rows[0]?.total_rows ?? 0, page: safePage, limit: safeLimit, view: v };
  }

  /** The chip totals above the list, for the same vendor / date / search filters (not for the chosen view). */
  async summary(f: InvoiceFilter) {
    const { sql, args } = this.base(f, await loadApprovalPolicy(this.manager));
    const [r] = await this.manager.query(
      `select count(*)::int as all_n,
              count(*) filter (where awaiting_approval)::int as appr_n, coalesce(round(sum(balance) filter (where awaiting_approval), 2), 0) as appr_amt,
              count(*) filter (where pending)::int as pending_n, coalesce(round(sum(balance) filter (where pending), 2), 0) as pending_amt,
              count(*) filter (where overdue)::int as overdue_n, coalesce(round(sum(total) filter (where overdue), 2), 0) as overdue_amt,
              count(*) filter (where due7)::int as due7_n, coalesce(round(sum(balance) filter (where due7), 2), 0) as due7_amt,
              count(*) filter (where on_hold)::int as hold_n, coalesce(round(sum(balance) filter (where on_hold), 2), 0) as hold_amt,
              count(*) filter (where is_paid)::int as paid_n, coalesce(round(sum(total) filter (where is_paid), 2), 0) as paid_amt,
              count(*) filter (where draft)::int as draft_n, coalesce(round(sum(total) filter (where draft), 2), 0) as draft_amt,
              count(*) filter (where awaiting)::int as awaiting_n, coalesce(round(sum(total) filter (where awaiting), 2), 0) as awaiting_amt,
              coalesce(max(days_waiting) filter (where awaiting), 0)::int as awaiting_oldest,
              count(*) filter (where not_ready)::int as notready_n, coalesce(round(sum(balance) filter (where not_ready), 2), 0) as notready_amt,
              count(*) filter (where ready)::int as ready_n, coalesce(round(sum(balance) filter (where ready), 2), 0) as ready_amt,
              count(*) filter (where ready_overdue)::int as ready_overdue_n, coalesce(round(sum(balance) filter (where ready_overdue), 2), 0) as ready_overdue_amt,
              count(*) filter (where ready_due7)::int as ready_due7_n, coalesce(round(sum(balance) filter (where ready_due7), 2), 0) as ready_due7_amt,
              count(*) filter (where ready_later)::int as ready_later_n, coalesce(round(sum(balance) filter (where ready_later), 2), 0) as ready_later_amt
         from (${sql}) x`, args);
    const n = (k: string) => +r[k];
    return {
      all: { count: n('all_n') },
      pending: { count: n('pending_n'), amount: n('pending_amt') },
      overdue: { count: n('overdue_n'), amount: n('overdue_amt') },
      due7: { count: n('due7_n'), amount: n('due7_amt') },
      hold: { count: n('hold_n'), amount: n('hold_amt') },
      paid: { count: n('paid_n'), amount: n('paid_amt') },
      draft: { count: n('draft_n'), amount: n('draft_amt') },
      awaiting: { count: n('awaiting_n'), amount: n('awaiting_amt'), oldest_days: n('awaiting_oldest') },
      approval: { count: n('appr_n'), amount: n('appr_amt') },
      // completed and owed but not yet marked payment ready: the next step after completing an invoice
      notready: { count: n('notready_n'), amount: n('notready_amt') },
      // what can be paid now, and when it falls due: the three parts add up to the whole, and none of it is on hold or waiting for approval
      ready: { count: n('ready_n'), amount: n('ready_amt') },
      ready_overdue: { count: n('ready_overdue_n'), amount: n('ready_overdue_amt') },
      ready_due7: { count: n('ready_due7_n'), amount: n('ready_due7_amt') },
      ready_later: { count: n('ready_later_n'), amount: n('ready_later_amt') },
    };
  }

  /** Payment history of one invoice, oldest first, with who recorded each entry. A reversal shows as its own line. */
  async payments(invoiceId: number) {
    const [inv] = await this.manager.query(`select id from purchase_invoice where id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    return this.manager.query(
      `select p.id, to_char(p.pay_date, 'YYYY-MM-DD') as paydate, p.amount::numeric as amount, p.pay_mode as paymode, p.trans_ref as transref,
              p.status, p.reverses_id as reversesid, p.batch_ref as batchref, p.remarks, p.created_on as createdon,
              u.full_name as createdby, p.communication_status as communicationstatus, p.communication_channel as communicationchannel
         from vendor_payment p left join app_user u on u.id = p.created_by
        where p.invoice_id = $1 order by p.pay_date, p.id`, [invoiceId]);
  }

  /** Puts a received invoice with a balance on hold: no payment can be recorded against it until released. */
  async hold(invoiceId: number, reason: string, userid: number) {
    const why = (reason || '').trim();
    if (why.length < 5) throw new BadRequestException('Give a reason of at least 5 characters.');
    const [inv] = await this.manager.query(
      `select i.id, i.invoice_no, i.status, i.total::numeric - coalesce((select sum(amount) from vendor_payment where invoice_id = i.id), 0)::numeric as balance
         from purchase_invoice i where i.id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.status !== 'COMPLETE') throw new BadRequestException('Only a received invoice can be put on hold.');
    if (+inv.balance <= 0.005) throw new BadRequestException('This invoice is already paid.');
    await this.manager.query(
      `update purchase_invoice set payment_status = 'On Hold', hold_reason = $2, hold_on = now(), hold_by = $3, updated_on = now(), updated_by = $3 where id = $1`,
      [invoiceId, why.slice(0, 200), userid]);
    await this.audit.record({ userId: userid, action: 'invoice.held', entityType: 'purchases', entityId: invoiceId,
      summary: `invoice ${inv.invoice_no} put on hold: ${why}`, details: { reason: why } });
    return { id: invoiceId, on_hold: true };
  }

  /**
   * The step after completing an invoice: says it is checked and may go to finance. Needed before a payment can be recorded. Anyone who works on
   * purchase invoices may do it; the person and an optional note are kept.
   */
  async markReady(invoiceId: number, note: string | undefined, userid: number) {
    const [inv] = await this.manager.query(
      `select i.id, i.invoice_no, i.status, i.payment_ready_on, i.payment_ready_by, i.total::numeric - coalesce((select sum(amount) from vendor_payment where invoice_id = i.id), 0)::numeric as balance
         from purchase_invoice i where i.id = $1 and i.active and not i.archive`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.status !== 'COMPLETE') throw new BadRequestException('Complete the invoice first: only a completed invoice can be marked ready for payment.');
    if (!inv.invoice_no) throw new BadRequestException("Enter the vendor's invoice number before marking it ready for payment.");
    if (+inv.balance <= 0.005) throw new BadRequestException('This invoice is already paid.');
    // already marked by a person: nothing changes. One that only counts as ready (carried over when marking was introduced) takes the person's mark.
    if (inv.payment_ready_on && inv.payment_ready_by) return { id: invoiceId, ready: true };
    const text = (note || '').trim().slice(0, 200) || null;
    await this.manager.query(`update purchase_invoice set payment_ready_by = $2, payment_ready_on = now(), payment_ready_note = $3, updated_on = now(), updated_by = $2 where id = $1`, [invoiceId, userid, text]);
    await this.audit.record({ userId: userid, action: 'invoice.payment_ready', entityType: 'purchases', entityId: invoiceId,
      summary: `invoice ${inv.invoice_no} marked ready for payment${text ? `: ${text}` : ''}`, details: { note: text } });
    return { id: invoiceId, ready: true };
  }

  /** Marks several invoices ready for payment at once, with one note; each is checked on its own and the ones that cannot be marked come back with the reason. */
  async markReadyBulk(ids: any, note: string | undefined, userid: number) {
    const list = this.idList(ids);
    const done: number[] = [], skipped: { id: number; invoice_no: string | null; reason: string }[] = [];
    for (const id of list) {
      try { await this.markReady(id, note, userid); done.push(id); }
      catch (e: any) {
        const [r] = await this.manager.query(`select invoice_no from purchase_invoice where id = $1`, [id]);
        skipped.push({ id, invoice_no: r?.invoice_no ?? null, reason: String(e?.response?.message ?? e?.message ?? 'Could not be marked.') });
      }
    }
    return { done: done.length, ids: done, skipped };
  }

  async unmarkReadyBulk(ids: any, userid: number) {
    const list = this.idList(ids);
    const done: number[] = [], skipped: { id: number; invoice_no: string | null; reason: string }[] = [];
    for (const id of list) {
      try { await this.unmarkReady(id, userid); done.push(id); }
      catch (e: any) {
        const [r] = await this.manager.query(`select invoice_no from purchase_invoice where id = $1`, [id]);
        skipped.push({ id, invoice_no: r?.invoice_no ?? null, reason: String(e?.response?.message ?? e?.message ?? 'Could not be taken back.') });
      }
    }
    return { done: done.length, ids: done, skipped };
  }

  private idList(ids: any): number[] {
    const list = Array.isArray(ids) ? ids.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0) : [];
    if (!list.length) throw new BadRequestException('Choose at least one invoice.');
    if (list.length > 200) throw new BadRequestException('Choose up to 200 invoices at a time.');
    return Array.from(new Set(list));
  }

  /**
   * What finance can pay now: the invoices marked ready for payment that are owed, not on hold and not waiting for approval, grouped by vendor
   * (overdue first), with each vendor's total, what is overdue and the oldest due date. The same filters as the list apply.
   */
  async queue(f: InvoiceFilter) {
    const { sql, args } = this.base(f, await loadApprovalPolicy(this.manager));
    const rows = await this.manager.query(`select * from (${sql}) x where ready order by due_date asc, id asc limit 2000`, args);
    const vendors = new Map<number, any>();
    const totals = { count: 0, balance: 0, overdue: 0, due7: 0 };
    for (const r of rows) {
      const bal = +r.balance, over = +r.days_overdue > 0;
      let v = vendors.get(r.vendor_id);
      if (!v) { v = { vendor_id: r.vendor_id, vendor_name: r.business_name, count: 0, balance: 0, overdue: 0, oldest_due: null as string | null, invoices: [] as any[] }; vendors.set(r.vendor_id, v); }
      v.count += 1; v.balance += bal; if (over) v.overdue += bal;
      if (!v.oldest_due || String(r.due_date) < v.oldest_due) v.oldest_due = String(r.due_date).slice(0, 10);
      v.invoices.push({ id: r.id, vendor_id: r.vendor_id, business_name: r.business_name, invoice_no: r.invoice_no, invoice_date: r.invoice_date, due_date: r.due_date, total: +r.total, paid_amount: +r.paid, balance_amount: bal,
        days_overdue: +r.days_overdue, ready_on: r.ready_on, ready_by: r.ready_by_name, ready_note: r.ready_note, payment_status: r.payment_status });
      totals.count += 1; totals.balance += bal; if (over) totals.overdue += bal; else if (r.ready_due7) totals.due7 += bal;
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const list = Array.from(vendors.values()).map((v) => ({ ...v, balance: round(v.balance), overdue: round(v.overdue) }))
      .sort((a, b) => b.overdue - a.overdue || b.balance - a.balance);
    return { vendors: list, totals: { count: totals.count, balance: round(totals.balance), overdue: round(totals.overdue), due7: round(totals.due7) } };
  }

  /** Takes the mark back (before anything is paid on it): the invoice is not ready for payment again. */
  async unmarkReady(invoiceId: number, userid: number) {
    const [inv] = await this.manager.query(
      `select i.id, i.invoice_no, i.payment_ready_on, coalesce((select sum(amount) from vendor_payment where invoice_id = i.id), 0)::numeric as paid from purchase_invoice i where i.id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (!inv.payment_ready_on) return { id: invoiceId, ready: false };
    if (+inv.paid > 0.005) throw new BadRequestException('A payment has been recorded against this invoice, so it stays ready.');
    await this.manager.query(`update purchase_invoice set payment_ready_by = null, payment_ready_on = null, payment_ready_note = null, updated_on = now(), updated_by = $2 where id = $1`, [invoiceId, userid]);
    await this.audit.record({ userId: userid, action: 'invoice.payment_unready', entityType: 'purchases', entityId: invoiceId, summary: `invoice ${inv.invoice_no}: payment ready mark withdrawn`, details: {} });
    return { id: invoiceId, ready: false };
  }

  /** clearing invoices for payment and changing the rule need the `invoices.approvepay` action (the owner roles hold it by name) */
  private async needApprover(userid: number, what: string) {
    if (!(await this.may(userid, 'invoices.approvepay'))) throw new ForbiddenException(`You are not allowed to ${what}.`);
  }

  private async may(userid: number, action: PurchasingAction): Promise<boolean> {
    const [r] = await this.manager.query(`select r.name, r.permissions from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [userid]);
    return !!r && canDoPurchasing(r.name, permsOf(r), action);
  }

  /** the rule, and whether the person asking may approve invoices and change the rule */
  async approvalSettings(userid: number) {
    return { ...(await loadApprovalPolicy(this.manager)), canmanage: await this.may(userid, 'invoices.approvepay') };
  }

  async setApprovalSettings(body: any, userid: number) {
    await this.needApprover(userid, 'change how invoices are approved for payment');
    const limit = Number(body?.limit ?? 0);
    if (!Number.isFinite(limit) || limit < 0 || limit > 100000000) throw new BadRequestException('The limit must be between 0 and 10,00,00,000.');
    const before = await loadApprovalPolicy(this.manager);
    const put = async (key: string, value: string, why: string) => {
      const upd = await this.manager.query(`update app_setting set setting_value = $2, updated_on = now(), updated_by = $3 where setting_key = $1 returning id`, [key, value, userid]);
      if (!affectedRows(upd)) await this.manager.query(
        `insert into app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by) values ('purchasing', $1, $2, $4, true, false, $3, $3)`, [key, value, userid, why]);
    };
    await put('invoice_approval', body?.enabled ? 'on' : 'off', 'Purchase invoices must be approved for payment before they can be paid (on / off)');
    await put('invoice_approval_limit', String(limit), 'Invoices up to this amount need no approval for payment (0 = every invoice needs approval)');
    await this.audit.record({ userId: userid, action: 'invoice.approval_rule', entityType: 'app_setting', entityId: null,
      summary: `Invoice approval for payment ${body?.enabled ? 'on' : 'off'}, no approval up to ${limit} (was ${before.enabled ? 'on' : 'off'}, ${before.limit})`, details: { from: before, to: { enabled: !!body?.enabled, limit } } });
    return { enabled: !!body?.enabled, limit };
  }

  /** Clears a received invoice for payment. The person who approves is recorded, with an optional note. */
  async approve(invoiceId: number, note: string | undefined, userid: number) {
    await this.needApprover(userid, 'approve an invoice for payment');
    const [inv] = await this.manager.query(
      `select i.id, i.invoice_no, i.status, i.approved_on, i.total::numeric - coalesce((select sum(amount) from vendor_payment where invoice_id = i.id), 0)::numeric as balance
         from purchase_invoice i where i.id = $1 and i.active and not i.archive`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.status !== 'COMPLETE') throw new BadRequestException('Only a completed invoice can be approved for payment.');
    if (!inv.invoice_no) throw new BadRequestException("Enter the vendor's invoice number before approving it for payment.");
    if (+inv.balance <= 0.005) throw new BadRequestException('This invoice is already paid.');
    if (inv.approved_on) return { id: invoiceId, approved: true };
    const text = (note || '').trim().slice(0, 200) || null;
    await this.manager.query(`update purchase_invoice set approved_by = $2, approved_on = now(), approval_note = $3, updated_on = now(), updated_by = $2 where id = $1`, [invoiceId, userid, text]);
    await this.audit.record({ userId: userid, action: 'invoice.approved', entityType: 'purchases', entityId: invoiceId,
      summary: `invoice ${inv.invoice_no} approved for payment${text ? `: ${text}` : ''}`, details: { note: text } });
    return { id: invoiceId, approved: true };
  }

  /** Takes the approval back (before anything is paid on it): the invoice waits for approval again. */
  async unapprove(invoiceId: number, userid: number) {
    await this.needApprover(userid, 'withdraw an approval');
    const [inv] = await this.manager.query(
      `select i.id, i.invoice_no, i.approved_on, coalesce((select sum(amount) from vendor_payment where invoice_id = i.id), 0)::numeric as paid from purchase_invoice i where i.id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (!inv.approved_on) return { id: invoiceId, approved: false };
    if (+inv.paid > 0.005) throw new BadRequestException('A payment has been recorded against this invoice, so its approval stays.');
    await this.manager.query(`update purchase_invoice set approved_by = null, approved_on = null, approval_note = null, updated_on = now(), updated_by = $2 where id = $1`, [invoiceId, userid]);
    await this.audit.record({ userId: userid, action: 'invoice.unapproved', entityType: 'purchases', entityId: invoiceId, summary: `invoice ${inv.invoice_no}: approval for payment withdrawn`, details: {} });
    return { id: invoiceId, approved: false };
  }

  async release(invoiceId: number, userid: number) {
    const [inv] = await this.manager.query(`select id, invoice_no, payment_status, hold_reason from purchase_invoice where id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.payment_status === 'On Hold') {
      await this.manager.query(
        `update purchase_invoice set payment_status = 'Unpaid', hold_reason = null, hold_on = null, hold_by = null, updated_on = now(), updated_by = $2 where id = $1`,
        [invoiceId, userid]);
      await this.audit.record({ userId: userid, action: 'invoice.released', entityType: 'purchases', entityId: invoiceId,
        summary: `invoice ${inv.invoice_no} released from hold`, details: { was: inv.hold_reason } });
    }
    return { id: invoiceId, on_hold: false };
  }
}

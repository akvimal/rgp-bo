import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { creditsEditable, returnLineProblem, returnLineValue, returnValue } from './vendor-return-rule';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** stock still in a batch at a store, and the credit rate it was bought at (per sale unit, before tax) */
const BATCH_SQL = `
  pii.id as itemid, pii.product_id as productid, p.title, pii.batch, to_char(pii.exp_date, 'YYYY-MM-DD') as expdate, pi.invoice_no as invoiceno, to_char(pi.invoice_date, 'YYYY-MM-DD') as invoicedate, pi.id as invoiceid,
  round((pii.ptr_value / coalesce(p.pack, 1) * (1 - coalesce(pii.disc_pcnt, 0) / 100))::numeric, 4)::float8 as rate, coalesce(pii.tax_pcnt, 0)::float8 as taxpcnt,
  ((pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)
    - coalesce((select sum(si.qty) from sale_item si join sale s on s.id = si.sale_id where si.purchase_item_id = pii.id and si.active and not si.archive and s.store_id = $2), 0)
    + coalesce((select sum(pq.qty) from product_qtychange pq where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active and not pq.archive and pq.store_id = $2), 0))::int as available
  from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id join product p on p.id = pii.product_id`;

/**
 * Goods sent back to a vendor. They are tracked here until the vendor credits them on a later purchase invoice: stock falls when the return is made,
 * and the return stays OPEN until it is adjusted on an invoice, where it comes off what that invoice comes to.
 */
@Injectable()
export class VendorReturnService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly invoices: PurchaseInvoiceService, private readonly audit: AuditService) {}

  async list(q: any) {
    const args: any[] = [];
    const where: string[] = ['r.active'];
    if (/^[0-9]+$/.test(String(q.vendor ?? ''))) { args.push(+q.vendor); where.push(`r.vendor_id = $${args.length}`); }
    if (['OPEN', 'ADJUSTED', 'CANCELLED'].includes(String(q.status ?? '').toUpperCase())) { args.push(String(q.status).toUpperCase()); where.push(`r.status = $${args.length}`); }
    return this.manager.query(
      `select r.id, r.vendor_id as vendorid, v.business_name as vendor, r.store_id as storeid, r.return_no as returnno, to_char(r.return_date, 'YYYY-MM-DD') as returndate, r.reason, r.status,
              r.total::float8 as total, r.adjusted_invoice_id as adjustedinvoiceid, pi.invoice_no as adjustedinvoiceno,
              (select count(*)::int from vendor_return_item i where i.return_id = r.id and i.active) as lines,
              (select string_agg(distinct fp.invoice_no, ', ') from vendor_return_item fi join purchase_invoice_item fpi on fpi.id = fi.item_id join purchase_invoice fp on fp.id = fpi.invoice_id
                where fi.return_id = r.id and fi.active) as frominvoices
         from vendor_return r join vendor v on v.id = r.vendor_id left join purchase_invoice pi on pi.id = r.adjusted_invoice_id
        where ${where.join(' and ')} order by r.id desc limit 300`, args);
  }

  async get(id: number) {
    const [r] = await this.manager.query(
      `select r.id, r.vendor_id as vendorid, v.business_name as vendor, r.store_id as storeid, r.return_no as returnno, to_char(r.return_date, 'YYYY-MM-DD') as returndate, r.reason, r.status,
              r.total::float8 as total, r.adjusted_invoice_id as adjustedinvoiceid, pi.invoice_no as adjustedinvoiceno, r.cancel_note as cancelnote
         from vendor_return r join vendor v on v.id = r.vendor_id left join purchase_invoice pi on pi.id = r.adjusted_invoice_id where r.id = $1 and r.active`, [id]);
    if (!r) throw new NotFoundException('Return not found.');
    r.items = await this.manager.query(
      `select i.id, i.item_id as itemid, i.product_id as productid, p.title, i.batch, i.qty, i.rate::float8 as rate, i.tax_pcnt::float8 as taxpcnt, i.total::float8 as total,
              fp.invoice_no as invoiceno, to_char(fp.invoice_date, 'YYYY-MM-DD') as invoicedate
         from vendor_return_item i join product p on p.id = i.product_id
         left join purchase_invoice_item fpi on fpi.id = i.item_id left join purchase_invoice fp on fp.id = fpi.invoice_id
        where i.return_id = $1 and i.active order by i.id`, [id]);
    return r;
  }

  /** the batches of a vendor's goods that can still go back: what is in stock at the store */
  async returnable(vendorid: number, storeid: number, text: string) {
    const t = String(text ?? '').trim();
    return this.manager.query(
      `select * from (select ${BATCH_SQL}
          where pi.vendor_id = $1 and pi.store_id = $2 and pi.status = 'COMPLETE' and pii.status = 'VERIFIED' and pii.active and not pii.archive and pi.active and not pi.archive
            and ($3 = '' or p.title ilike '%' || $3 || '%' or pii.batch ilike '%' || $3 || '%' or pi.invoice_no ilike '%' || $3 || '%')) x
        where x.available > 0 order by x.title, x.expdate limit 100`, [vendorid, storeid, t]);
  }

  private async batchesById(tm: EntityManager, vendorid: number, storeid: number, ids: number[]) {
    const rows = await tm.query(
      `select ${BATCH_SQL} where pii.id = any($3::int[]) and pi.vendor_id = $1 and pi.store_id = $2 and pii.active and not pii.archive`, [vendorid, storeid, ids]);
    return new Map<number, any>(rows.map((r: any) => [+r.itemid, r]));
  }

  async create(dto: any, userid: number) {
    const vendorid = Number(dto?.vendorid), storeid = Number(dto?.storeid);
    if (!vendorid || !storeid) throw new BadRequestException('Choose the vendor and the store the goods are going back from.');
    const lines: any[] = Array.isArray(dto?.items) ? dto.items : [];
    if (!lines.length) throw new BadRequestException('Add at least one item going back.');
    if (new Set(lines.map((l) => Number(l.itemid))).size !== lines.length) throw new BadRequestException('A batch is listed twice. Add the quantities together on one line.');
    const reason = String(dto?.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dto?.returndate ?? '')) ? dto.returndate : null;
    return this.manager.transaction(async (tm) => {
      const stock = await this.batchesById(tm, vendorid, storeid, lines.map((l) => Number(l.itemid)));
      const prepared: any[] = [];
      for (const l of lines) {
        const s = stock.get(Number(l.itemid));
        if (!s) throw new BadRequestException("One of the items is not this vendor's stock at this store.");
        const rate = l.rate === undefined || l.rate === null || l.rate === '' ? s.rate : Number(l.rate);
        const problem = returnLineProblem({ qty: l.qty, rate }, s.available, s.title);
        if (problem) throw new BadRequestException(problem);
        prepared.push({ ...s, qty: Number(l.qty), rate, total: returnLineValue({ qty: Number(l.qty), rate, taxpcnt: s.taxpcnt }).taxable });
      }
      const value = returnValue(prepared.map((p) => ({ qty: p.qty, rate: p.rate, taxpcnt: p.taxpcnt })));
      const [ret] = await tm.query(
        `insert into vendor_return (vendor_id, store_id, return_no, return_date, reason, total, created_by, updated_by)
         values ($1, $2, nullif($3, ''), coalesce($4::date, current_date), nullif($5, ''), $6, $7, $7) returning id`,
        [vendorid, storeid, String(dto?.returnno ?? '').trim().slice(0, 30), date, reason, value.total, userid]);
      for (const p of prepared) {
        // stock leaves with the return, the same way a stock adjustment takes it out
        const [q] = await tm.query(
          `insert into product_qtychange (item_id, qty, sale_price, reason, reason_code, status, comments, store_id, discarded, created_by)
           values ($1, $2, 0, 'Returned to vendor', 'VENDOR_RETURN', 'APPROVED', $3, $4, false, $5) returning id`,
          [p.itemid, -p.qty, `Return ${ret.id} to vendor`, storeid, userid]);
        await tm.query(
          `insert into vendor_return_item (return_id, item_id, product_id, batch, qty, rate, tax_pcnt, total, qtychange_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [ret.id, p.itemid, p.productid, p.batch, p.qty, p.rate, p.taxpcnt, p.total, q.id]);
      }
      await this.audit.record({ userId: userid, action: 'purchase.vendor_return_made', entityType: 'vendor_return', entityId: ret.id,
        summary: `${prepared.length} item${prepared.length === 1 ? '' : 's'} returned to the vendor, credit ${value.total.toFixed(2)}`, details: { vendorid, storeid, reason } });
      return { id: ret.id, total: value.total };
    });
  }

  /** an open return that has not been adjusted anywhere is called off: the goods come back into stock */
  async cancel(id: number, note: any, userid: number) {
    const text = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (text.length < 3) throw new BadRequestException('Say in a few words why the return is cancelled.');
    return this.manager.transaction(async (tm) => {
      const [r] = await tm.query(`select id, status, store_id from vendor_return where id = $1 and active for update`, [id]);
      if (!r) throw new NotFoundException('Return not found.');
      if (r.status !== 'OPEN') throw new BadRequestException(r.status === 'ADJUSTED' ? 'This return is already adjusted on an invoice. Take it off the invoice first.' : 'This return is already cancelled.');
      const items = await tm.query(`select item_id, qty from vendor_return_item where return_id = $1 and active`, [id]);
      for (const i of items) {
        await tm.query(
          `insert into product_qtychange (item_id, qty, sale_price, reason, reason_code, status, comments, store_id, discarded, created_by)
           values ($1, $2, 0, 'Vendor return cancelled', 'VENDOR_RETURN_UNDO', 'APPROVED', $3, $4, false, $5)`, [i.item_id, +i.qty, `Return ${id} cancelled`, r.store_id, userid]);
      }
      await tm.query(`update vendor_return set status = 'CANCELLED', cancel_note = $2, updated_by = $3, updated_on = now() where id = $1`, [id, text, userid]);
      await this.audit.record({ userId: userid, action: 'purchase.vendor_return_cancelled', entityType: 'vendor_return', entityId: id, summary: `Vendor return ${id} cancelled: ${text}`, details: {} });
      return { cancelled: true };
    });
  }

  // ------------------------------------------------------------------ on an invoice
  /** the returns the vendor of this invoice has not yet credited, and the ones already adjusted on it */
  async creditsFor(invoiceid: number) {
    const [inv] = await this.manager.query(`select id, vendor_id, status from purchase_invoice where id = $1`, [invoiceid]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    const applied = await this.manager.query(
      `select c.id, c.return_id as returnid, r.return_no as returnno, to_char(r.return_date, 'YYYY-MM-DD') as returndate, r.reason, c.amount::float8 as amount, r.total::float8 as returntotal,
              (select string_agg(distinct fp.invoice_no, ', ') from vendor_return_item fi join purchase_invoice_item fpi on fpi.id = fi.item_id join purchase_invoice fp on fp.id = fpi.invoice_id
                where fi.return_id = r.id and fi.active) as frominvoices,
              (select string_agg(p.title || ' x' || i.qty, ', ' order by i.id) from vendor_return_item i join product p on p.id = i.product_id where i.return_id = r.id and i.active) as summary
         from purchase_invoice_credit c join vendor_return r on r.id = c.return_id where c.invoice_id = $1 and c.active order by c.id`, [invoiceid]);
    const open = await this.manager.query(
      `select r.id, r.return_no as returnno, to_char(r.return_date, 'YYYY-MM-DD') as returndate, r.reason, r.total::float8 as total,
              (select string_agg(distinct fp.invoice_no, ', ') from vendor_return_item fi join purchase_invoice_item fpi on fpi.id = fi.item_id join purchase_invoice fp on fp.id = fpi.invoice_id
                where fi.return_id = r.id and fi.active) as frominvoices,
              (select string_agg(p.title || ' x' || i.qty, ', ' order by i.id) from vendor_return_item i join product p on p.id = i.product_id where i.return_id = r.id and i.active) as summary
         from vendor_return r where r.vendor_id = $1 and r.status = 'OPEN' and r.active order by r.id`, [inv.vendor_id]);
    const { editable, reason } = creditsEditable(inv.status, await this.paidOn(invoiceid));
    return { applied, open, editable, reason, completed: inv.status === 'COMPLETE' };
  }

  /** the vendor credited this return on this invoice: `amount` is what the vendor actually took off (defaults to the value of the return) */
  async addCredit(invoiceid: number, returnid: number, amount: any, userid: number) {
    const [inv] = await this.manager.query(`select id, vendor_id, status from purchase_invoice where id = $1 and active and not archive`, [invoiceid]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    const can = creditsEditable(inv.status, await this.paidOn(invoiceid));
    if (!can.editable) throw new BadRequestException(can.reason);
    const [r] = await this.manager.query(`select id, vendor_id, status, total::float8 as total from vendor_return where id = $1 and active`, [returnid]);
    if (!r) throw new NotFoundException('Return not found.');
    if (+r.vendor_id !== +inv.vendor_id) throw new BadRequestException('That return is to a different vendor.');
    if (r.status !== 'OPEN') throw new BadRequestException(r.status === 'ADJUSTED' ? 'That return is already adjusted on an invoice.' : 'That return was cancelled.');
    const credit = amount === undefined || amount === null || amount === '' ? r.total : r2(Number(amount));
    if (!(credit > 0)) throw new BadRequestException('Enter the amount the vendor credited for this return.');
    const f = r.total > 0 ? credit / r.total : 1;
    const [vals] = await this.manager.query(`select coalesce(sum(total), 0)::float8 as taxable from vendor_return_item where return_id = $1 and active`, [returnid]);
    const taxable = r2(vals.taxable * f), tax = r2(credit - taxable);
    await this.manager.query(`insert into purchase_invoice_credit (invoice_id, return_id, taxable, tax, amount, created_by) values ($1, $2, $3, $4, $5, $6)`, [invoiceid, returnid, taxable, tax, credit, userid]);
    await this.manager.query(`update vendor_return set status = 'ADJUSTED', adjusted_invoice_id = $2, adjusted_on = now(), updated_by = $3, updated_on = now() where id = $1`, [returnid, invoiceid, userid]);
    try {
      await this.invoices.refreshTotal(invoiceid, userid);
    } catch (e) {
      // a credit bigger than the purchase is refused: undo the adjustment
      await this.manager.query(`delete from purchase_invoice_credit where invoice_id = $1 and return_id = $2`, [invoiceid, returnid]);
      await this.manager.query(`update vendor_return set status = 'OPEN', adjusted_invoice_id = null, adjusted_on = null where id = $1`, [returnid]);
      throw e;
    }
    return { ok: true, warning: await this.reconWarning(invoiceid, inv.status) };
  }

  /** what has been paid on the invoice, as the invoice list counts it (a payment that was reversed nets to nothing) */
  private async paidOn(invoiceid: number): Promise<number> {
    const [p] = await this.manager.query(`select coalesce(sum(amount), 0)::float8 as paid from vendor_payment where invoice_id = $1`, [invoiceid]);
    return +(p?.paid || 0);
  }

  /** a completed invoice already matched against the vendor's GSTR-2B no longer agrees with it once its total changes */
  private async reconWarning(invoiceid: number, status: string): Promise<string | null> {
    if (status !== 'COMPLETE') return null;
    const [i] = await this.manager.query(`select gst_recon_status as s from purchase_invoice where id = $1`, [invoiceid]);
    return i && i.s && i.s !== 'UNRECONCILED'
      ? 'This invoice was already reconciled with GSTR-2B. Its total and tax have come down by the return, so check it again against the credit note from the vendor.'
      : null;
  }

  async removeCredit(invoiceid: number, creditid: number, userid: number) {
    const [c] = await this.manager.query(
      `select c.id, c.return_id, v.status from purchase_invoice_credit c join purchase_invoice v on v.id = c.invoice_id where c.id = $1 and c.invoice_id = $2 and c.active`, [creditid, invoiceid]);
    if (!c) throw new NotFoundException('That return is not adjusted on this invoice.');
    const can = creditsEditable(c.status, await this.paidOn(invoiceid));
    if (!can.editable) throw new BadRequestException(can.reason.replace('adjusted on', 'taken off'));
    await this.manager.query(`delete from purchase_invoice_credit where id = $1`, [creditid]);
    await this.manager.query(`update vendor_return set status = 'OPEN', adjusted_invoice_id = null, adjusted_on = null, updated_by = $2, updated_on = now() where id = $1`, [c.return_id, userid]);
    await this.invoices.refreshTotal(invoiceid, userid);
    return { ok: true, warning: await this.reconWarning(invoiceid, c.status) };
  }
}

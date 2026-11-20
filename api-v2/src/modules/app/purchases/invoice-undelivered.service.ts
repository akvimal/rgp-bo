import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { PurchaseService } from './purchase.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';

/** what can be done with an order line the vendor did not deliver */
export const UNDELIVERED_ACTIONS = ['wait', 'new', 'existing', 'request'] as const;

/**
 * Lines of the order an invoice is against that the vendor has not delivered, and what becomes of each: wait for it on the same order, order it again (a new
 * order for the same or another vendor), add it to another open order, or keep it as a request to order later. A moved line leaves the original order as "not
 * delivered" (its quantity there is cut to what was delivered), and a new line carries the quantity to where it was sent.
 */
@Injectable()
export class InvoiceUndeliveredService {

  constructor(@InjectEntityManager() private manager: EntityManager, private invoices: PurchaseInvoiceService, private orders: PurchaseService) {}

  /** the lines to decide on, and the orders the quantity can be added to */
  async list(invoiceid: number) {
    const lines = await this.invoices.undeliveredOf(invoiceid);
    const [inv] = await this.manager.query(
      `select i.status, i.purchase_order_id, i.vendor_id, i.undelivered_checked_qty from purchase_invoice i where i.id = $1`, [invoiceid]);
    if (!inv) throw new BadRequestException('That invoice was not found.');
    const open = inv.purchase_order_id ? await this.manager.query(
      `select o.id, o.status, o.vendor_id, btrim(v.business_name) as vendor, o.created_on,
              (select count(*)::int from purchase_request r where r.order_id = o.id and r.active and not r.archive) as lines
         from purchase_order o join vendor v on v.id = o.vendor_id
        where o.status in ('PENDING', 'SUBMITTED') and o.active and not o.archive and o.id <> $1 order by o.id desc limit 100`, [+inv.purchase_order_id]) : [];
    return {
      invoice_id: invoiceid, order_id: inv.purchase_order_id ? +inv.purchase_order_id : null, vendor_id: inv.vendor_id, status: inv.status,
      decided_qty: inv.undelivered_checked_qty === null ? null : +inv.undelivered_checked_qty,
      lines, open_orders: open,
    };
  }

  /**
   * Record the decisions. moves: [{ requestid, qty, action, vendorid?, orderid? }]. A line left out, or 'wait', stays on its order for a later delivery. The
   * quantity still waiting is what the invoice is then allowed to be completed with.
   */
  async decide(invoiceid: number, moves: any[], userid: number, roleid?: number) {
    const [inv] = await this.manager.query(`select id, status, invoice_no, purchase_order_id from purchase_invoice where id = $1 and active and not archive`, [invoiceid]);
    if (!inv) throw new BadRequestException('That invoice was not found.');
    if (!inv.purchase_order_id) throw new BadRequestException('This invoice is not against a purchase order.');
    if (inv.status === 'COMPLETE') throw new BadRequestException('This invoice is complete. Items not delivered are decided before it is completed.');

    const lines = await this.invoices.undeliveredOf(invoiceid);
    const byRequest = new Map<number, any>(lines.map((l: any) => [+l.request_id, l]));
    const seen = new Set<number>();
    const todo: any[] = [];
    for (const m of moves || []) {
      const rid = +m?.requestid;
      const line = byRequest.get(rid);
      if (!line) throw new BadRequestException('One of those lines is not an undelivered line of this order.');
      if (seen.has(rid)) throw new BadRequestException(`${line.title} is listed twice.`);
      seen.add(rid);
      const action = String(m?.action || 'wait');
      if (!(UNDELIVERED_ACTIONS as readonly string[]).includes(action)) throw new BadRequestException(`${line.title}: choose what to do with it.`);
      if (action === 'wait') continue;
      const qty = Math.floor(+m?.qty || 0);
      if (!(qty >= 1) || qty > line.undelivered) throw new BadRequestException(`${line.title}: the quantity moved must be between 1 and ${line.undelivered}.`);
      const move: any = { line, qty, action, vendorid: line.vendor_id, orderid: null };
      if (action === 'new') {
        move.vendorid = +m?.vendorid || +line.po_vendor_id;
        if (!move.vendorid) throw new BadRequestException(`${line.title}: choose the vendor for the new order.`);
      }
      if (action === 'existing') {
        const [o] = await this.manager.query(`select id, status, vendor_id from purchase_order where id = $1 and active and not archive`, [+m?.orderid || 0]);
        if (!o) throw new BadRequestException(`${line.title}: choose the order to add it to.`);
        if (+o.id === +inv.purchase_order_id) throw new BadRequestException(`${line.title}: choose a different order, this invoice is against order ${o.id}.`);
        if (!['PENDING', 'SUBMITTED'].includes(o.status)) throw new BadRequestException(`Order ${o.id} is not open (${String(o.status).toLowerCase().replace('_', ' ')}).`);
        move.orderid = +o.id; move.vendorid = o.vendor_id; move.ostatus = o.status;
      }
      todo.push(move);
    }

    // 1. leave the original order, and make the line that carries the quantity on
    const made = await this.manager.transaction(async (tx) => {
      const out: any[] = [];
      for (const m of todo) {
        const l = m.line;
        const where = m.action === 'request' ? 'kept as a request' : m.action === 'new' ? 'ordered again' : `added to order ${m.orderid}`;
        const left = l.ordered - m.qty;
        await tx.query(
          `update purchase_request set ordered_qty = $2, not_delivered_qty = coalesce(not_delivered_qty, 0) + $3,
                  moved_note = $4, status = case when $2 <= 0 then 'Not delivered' else status end, updated_by = $5, updated_on = now()
            where id = $1`,
          [l.request_id, Math.max(0, left), m.qty, `${m.qty} not delivered on invoice ${inv.invoice_no || invoiceid}, ${where}`.slice(0, 300), userid]);
        const [row] = await tx.query(
          `insert into purchase_request (product_id, requested_name, group_id, store_id, vendor_id, status, request_type, source, priority, qty, suggested_qty,
                                         customer_name, customer_phone, needed_by, source_ref, comments, notes, moved_from_request_id, moved_note, created_by, updated_by)
           select product_id, requested_name, group_id, store_id, $2, 'Reviewed', request_type, source, priority, $3, suggested_qty,
                  customer_name, customer_phone, needed_by, source_ref, comments, notes, id, $4, $5, $5
             from purchase_request where id = $1 returning id`,
          [l.request_id, m.vendorid, m.qty, `from order ${inv.purchase_order_id}: not delivered on invoice ${inv.invoice_no || invoiceid}`.slice(0, 300), userid]);
        out.push({ ...m, newid: +row.id });
      }
      return out;
    });

    // 2. put the new lines where they were sent
    const results: any[] = [];
    const newByVendor = new Map<number, any[]>();
    for (const m of made) {
      if (m.action === 'new') newByVendor.set(+m.vendorid, [...(newByVendor.get(+m.vendorid) || []), m]);
    }
    for (const [vendorid, ms] of Array.from(newByVendor.entries())) {
      const order: any = await this.orders.createOrder({ vendorid, comments: `Not delivered on order ${inv.purchase_order_id}, invoice ${inv.invoice_no || invoiceid}` } as any, userid);
      await this.attach(order.id, ms);
      results.push({ action: 'new', order_id: order.id, vendor_id: vendorid, lines: ms.length });
    }
    const existing = new Map<number, any[]>();
    for (const m of made) if (m.action === 'existing') existing.set(m.orderid, [...(existing.get(m.orderid) || []), m]);
    for (const [orderid, ms] of Array.from(existing.entries())) {
      if (ms[0].ostatus === 'PENDING') await this.attach(orderid, ms);
      else await this.orders.amendOrder(orderid, { requestids: ms.map((x) => x.newid), comment: `Not delivered on order ${inv.purchase_order_id}, invoice ${inv.invoice_no || invoiceid}` }, userid, roleid);
      results.push({ action: 'existing', order_id: orderid, lines: ms.length, sent_for_approval: ms[0].ostatus !== 'PENDING' });
    }
    const asRequest = made.filter((m) => m.action === 'request');
    if (asRequest.length) results.push({ action: 'request', lines: asRequest.length });

    // 3. what is still waiting is what the user has now accepted for a later delivery
    const rest = await this.invoices.undeliveredOf(invoiceid);
    const waiting = rest.reduce((t: number, l: any) => t + l.undelivered, 0);
    await this.manager.query(`update purchase_invoice set undelivered_checked_qty = $2, updated_by = $3, updated_on = now() where id = $1`, [invoiceid, waiting, userid]);
    return { moved: made.length, results, waiting_qty: waiting };
  }

  private async attach(orderid: number, ms: any[]) {
    for (const m of ms) {
      await this.manager.query(`update purchase_request set status = 'Ordered', order_id = $2, ordered_qty = $3 where id = $1`, [m.newid, +orderid, m.qty]);
    }
  }
}

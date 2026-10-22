import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const KINDS = ['INVOICE_FIX', 'DEFECTIVE', 'SHORT_SUPPLY', 'WRONG_ITEM', 'OTHER'];
const FIELDS = ['RATE', 'QTY', 'TAX', 'MRP', 'EXPIRY', 'BATCH', 'OTHER'];
const VIAS = ['PHONE', 'EMAIL', 'WHATSAPP', 'VISIT', 'OTHER'];
const RESOLUTIONS = ['CREDIT_NOTE', 'REFUND', 'REPLACEMENT', 'CORRECTED_INVOICE'];
/** kinds where goods physically go back to the vendor */
const GOODS_BACK = ['DEFECTIVE', 'WRONG_ITEM'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const r2 = (n: number) => Math.round(n * 100) / 100;
const text = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const today = () => new Date().toISOString().slice(0, 10);

type Ctx = { id: number; role: string; stores: number[]; manage: boolean };

/** how much of a batch the store still holds: received there, less sold there, plus approved adjustments there */
const AVAILABLE_AT_STORE = `
  (case when i.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
  - coalesce((select sum(si.qty) from sale_item si inner join sale s on s.id = si.sale_id
               where si.purchase_item_id = pii.id and si.active = true and si.archive = false and s.store_id = $2), 0)
  + coalesce((select sum(pq.qty) from product_qtychange pq
               where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active = true and pq.archive = false and pq.store_id = $2), 0)`;

/**
 * Vendor grievances: invoice corrections and goods to send back. Business Head sees and decides everything; a Store Head
 * raises issues for their stores, sees the ones of their stores, and sends defective goods back.
 */
@Injectable()
export class VendorIssueService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async ctx(user: any): Promise<Ctx> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    const role = r?.name || '';
    return { id: user.id, role, stores: s.map((x: any) => x.store_id), manage: role === 'Business Head' };
  }

  private visible(c: Ctx, args: any[]): string {
    if (c.manage) return 'true';
    args.push(c.id, c.stores.length ? c.stores : [0]);
    return `(q.raised_by = $${args.length - 1} or q.store_id = any($${args.length}::int[]))`;
  }

  private canSee(c: Ctx, q: { raised_by: number; store_id: number | null }) {
    return c.manage || q.raised_by === c.id || (q.store_id !== null && c.stores.includes(q.store_id));
  }

  private async load(id: number) {
    const [q] = await this.manager.query(`select * from vendor_issue where id = $1`, [id]);
    if (!q) throw new NotFoundException('Issue not found.');
    return q;
  }

  // ------------------------------------------------------------------ pick lists
  async options(user: any) {
    const c = await this.ctx(user);
    const vendors = await this.manager.query(`select id, business_name as name from vendor where active and not archive order by business_name`);
    const stores = c.manage
      ? await this.manager.query(`select id, location as name from stores where active and not archive order by location`)
      : await this.manager.query(`select id, location as name from stores where id = any($1::int[]) and active order by location`, [c.stores.length ? c.stores : [0]]);
    return { vendors, stores, kinds: KINDS, fields: FIELDS, vias: VIAS, resolutions: RESOLUTIONS, role: c.role, canManage: c.manage };
  }

  async invoices(vendorId: number) {
    return this.manager.query(
      `select id, invoice_no, to_char(invoice_date, 'YYYY-MM-DD') as invoice_date, coalesce(total, 0)::float as total
         from purchase_invoice where vendor_id = $1 and active and not archive order by invoice_date desc, id desc limit 60`, [vendorId]);
  }

  async invoiceItems(invoiceId: number, storeId: number | null) {
    return this.manager.query(
      `select pii.id, p.title, pii.batch, to_char(pii.exp_date, 'YYYY-MM-DD') as exp_date, pii.qty, coalesce(pii.free_qty, 0) as free_qty, pii.ptr_cost::float as ptr_cost,
              pii.mrp_cost::float as mrp_cost, coalesce(pii.tax_pcnt, 0)::float as tax_pcnt,
              (${AVAILABLE_AT_STORE})::int as available
         from purchase_invoice_item pii join purchase_invoice i on i.id = pii.invoice_id join product p on p.id = pii.product_id
        where pii.invoice_id = $1 and pii.active and not pii.archive order by p.title, pii.batch`, [invoiceId, storeId]);
  }

  // ------------------------------------------------------------------ list / detail
  async list(q: any, user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const where: string[] = [this.visible(c, args)];
    const status = String(q?.status || 'ACTIVE').toUpperCase();
    if (status === 'ACTIVE') where.push(`q.status in ('OPEN', 'WITH_VENDOR')`);
    else if (['OPEN', 'WITH_VENDOR', 'RESOLVED', 'REJECTED', 'CANCELLED'].includes(status)) { args.push(status); where.push(`q.status = $${args.length}`); }
    if (q?.overdue === 'true') where.push(`q.status = 'WITH_VENDOR' and q.due_on < current_date`);
    if (+q?.vendor_id) { args.push(+q.vendor_id); where.push(`q.vendor_id = $${args.length}`); }
    if (KINDS.includes(String(q?.kind))) { args.push(q.kind); where.push(`q.kind = $${args.length}`); }
    if (text(q?.q, 60)) {
      args.push(`%${text(q.q, 60)}%`);
      where.push(`(q.summary ilike $${args.length} or q.issue_no ilike $${args.length} or v.business_name ilike $${args.length} or pi.invoice_no ilike $${args.length})`);
    }
    return this.manager.query(
      `select q.id, q.issue_no, q.kind, q.status, q.summary, q.vendor_id, v.business_name as vendor, q.invoice_id, pi.invoice_no, q.store_id, st.location as store,
              q.claimed_amount::float as claimed, q.credit_amount::float as credit_amount, q.resolution, to_char(q.due_on, 'YYYY-MM-DD') as due_on, q.sent_on, q.raised_on,
              r.full_name as raised_name, (q.status = 'WITH_VENDOR' and q.due_on < current_date) as overdue,
              (select count(*)::int from vendor_issue_line l where l.issue_id = q.id) as lines
         from vendor_issue q join vendor v on v.id = q.vendor_id left join purchase_invoice pi on pi.id = q.invoice_id left join stores st on st.id = q.store_id
         join app_user r on r.id = q.raised_by
        where ${where.join(' and ')} order by (q.status in ('OPEN', 'WITH_VENDOR')) desc, q.raised_on desc limit 300`, args);
  }

  async summary(user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const vis = this.visible(c, args);
    const [s] = await this.manager.query(
      `select count(*) filter (where q.status = 'OPEN')::int as open,
              count(*) filter (where q.status = 'WITH_VENDOR')::int as with_vendor,
              count(*) filter (where q.status = 'WITH_VENDOR' and q.due_on < current_date)::int as overdue,
              coalesce(sum(q.claimed_amount) filter (where q.status in ('OPEN', 'WITH_VENDOR')), 0)::float as claimed_open,
              coalesce(sum(q.credit_amount) filter (where q.status = 'RESOLVED' and q.resolved_on >= date_trunc('month', current_date)), 0)::float as recovered_this_month
         from vendor_issue q where ${vis}`, args);
    return s;
  }

  async get(id: number, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot see this issue.');
    const [head] = await this.manager.query(
      `select q.*, q.claimed_amount::float as claimed, q.credit_amount::float as credit_amt, to_char(q.due_on, 'YYYY-MM-DD') as due_on_text,
              v.business_name as vendor, v.contact_name, v.contact_phone, pi.invoice_no, st.location as store, r.full_name as raised_name, rs.full_name as resolved_name
         from vendor_issue q join vendor v on v.id = q.vendor_id left join purchase_invoice pi on pi.id = q.invoice_id left join stores st on st.id = q.store_id
         join app_user r on r.id = q.raised_by left join app_user rs on rs.id = q.resolved_by where q.id = $1`, [id]);
    const lines = await this.manager.query(
      `select l.id, l.purchase_item_id, l.description, l.field, l.billed_value, l.correct_value, l.qty, l.unit_cost::float as unit_cost, l.amount::float as amount, l.returned_qty, l.returned_on,
              p.title, pii.batch, to_char(pii.exp_date, 'YYYY-MM-DD') as exp_date
         from vendor_issue_line l left join purchase_invoice_item pii on pii.id = l.purchase_item_id left join product p on p.id = pii.product_id
        where l.issue_id = $1 order by l.id`, [id]);
    const notes = await this.manager.query(
      `select n.id, n.note, n.created_on, u.full_name as by_name from vendor_issue_note n join app_user u on u.id = n.created_by where n.issue_id = $1 order by n.created_on, n.id`, [id]);
    return { ...head, due_on: head.due_on_text, credit_amount: head.credit_amt, lines, notes };
  }

  // ------------------------------------------------------------------ create / edit
  private async cleanLines(kind: string, raw: any, vendorId: number, invoiceId: number | null, storeId: number | null, forReturn: boolean) {
    const rows: any[] = Array.isArray(raw) ? raw : [];
    const out: any[] = [];
    for (const l of rows) {
      const itemId = Number(l?.purchase_item_id) || null;
      let unitCost = l?.unit_cost !== undefined && l?.unit_cost !== null && l?.unit_cost !== '' ? Number(l.unit_cost) : null;
      let desc = text(l?.description, 120);
      const qty = l?.qty !== undefined && l?.qty !== null && l?.qty !== '' ? Math.floor(Number(l.qty)) : null;
      if (qty !== null && (!Number.isFinite(qty) || qty <= 0 || qty > 100000)) throw new BadRequestException('A quantity must be a whole number above zero.');
      if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) throw new BadRequestException('A cost cannot be negative.');
      if (itemId) {
        const [it] = await this.manager.query(
          `select pii.id, pii.ptr_cost::float as ptr_cost, pii.invoice_id, i.vendor_id, p.title, pii.batch from purchase_invoice_item pii join purchase_invoice i on i.id = pii.invoice_id join product p on p.id = pii.product_id where pii.id = $1`, [itemId]);
        if (!it || it.vendor_id !== vendorId) throw new BadRequestException('A line refers to goods that did not come from this vendor.');
        if (invoiceId && it.invoice_id !== invoiceId) throw new BadRequestException('A line refers to goods from a different invoice.');
        if (unitCost === null) unitCost = it.ptr_cost;
        desc = desc ?? `${it.title} ${it.batch ? '(' + it.batch + ')' : ''}`.trim();
        if (GOODS_BACK.includes(kind) && qty && forReturn !== undefined) {
          if (!storeId) throw new BadRequestException('Choose the store the goods are at.');
          const [a] = await this.manager.query(`select (${AVAILABLE_AT_STORE})::int as available from purchase_invoice_item pii join purchase_invoice i on i.id = pii.invoice_id join product p on p.id = pii.product_id where pii.id = $1`, [itemId, storeId]);
          if (!a || a.available < qty) throw new BadRequestException(`${it.title}: only ${Math.max(a?.available ?? 0, 0)} in stock at that store, cannot send back ${qty}.`);
        }
      }
      const field = l?.field ? String(l.field).toUpperCase() : null;
      if (field && !FIELDS.includes(field)) throw new BadRequestException('Choose what is wrong on the invoice line.');
      if (kind === 'INVOICE_FIX' && !field) throw new BadRequestException('For an invoice correction, say what is wrong on each line.');
      let amount = l?.amount !== undefined && l?.amount !== null && l?.amount !== '' ? Number(l.amount) : (qty !== null && unitCost !== null ? qty * unitCost : 0);
      if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('An amount cannot be negative.');
      if (!desc && !itemId) throw new BadRequestException('Describe each line.');
      out.push({ purchase_item_id: itemId, description: desc, field, billed_value: text(l?.billed_value, 40), correct_value: text(l?.correct_value, 40), qty, unit_cost: unitCost, amount: r2(amount) });
    }
    return out;
  }

  async create(b: any, user: any) {
    const c = await this.ctx(user);
    const kind = String(b?.kind || '');
    if (!KINDS.includes(kind)) throw new BadRequestException('Choose the kind of issue.');
    const summary = text(b?.summary, 200);
    if (!summary) throw new BadRequestException('Give the issue a short summary.');
    const [v] = await this.manager.query(`select id from vendor where id = $1 and active and not archive`, [Number(b?.vendor_id)]);
    if (!v) throw new BadRequestException('Choose the vendor.');
    const invoiceId = Number(b?.invoice_id) || null;
    if (invoiceId) {
      const [inv] = await this.manager.query(`select vendor_id from purchase_invoice where id = $1`, [invoiceId]);
      if (!inv || inv.vendor_id !== v.id) throw new BadRequestException('That invoice is not this vendor\'s.');
    }
    const storeId = Number(b?.store_id) || null;
    if (storeId) {
      const [st] = await this.manager.query(`select id from stores where id = $1 and active and not archive`, [storeId]);
      if (!st) throw new BadRequestException('That store was not found.');
      if (!c.manage && !c.stores.includes(storeId)) throw new ForbiddenException('You can raise issues for your own stores only.');
    } else if (!c.manage) throw new BadRequestException('Choose the store this is about.');
    const lines = await this.cleanLines(kind, b?.lines, v.id, invoiceId, storeId, true);
    if (['INVOICE_FIX', 'DEFECTIVE'].includes(kind) && !lines.length) throw new BadRequestException(kind === 'INVOICE_FIX' ? 'Add the invoice lines that need correcting.' : 'Add the goods that are defective.');
    if (kind === 'OTHER' && !text(b?.details, 1000)) throw new BadRequestException('Describe the issue.');
    const claimed = lines.length ? r2(lines.reduce((t, l) => t + l.amount, 0)) : r2(Number(b?.claimed_amount) || 0);
    if (!(claimed >= 0)) throw new BadRequestException('The amount claimed cannot be negative.');

    const id = await this.manager.transaction(async tm => {
      const [row] = await tm.query(
        `insert into vendor_issue (vendor_id, invoice_id, store_id, kind, summary, details, claimed_amount, raised_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [v.id, invoiceId, storeId, kind, summary, text(b?.details, 1000), claimed, c.id]);
      await tm.query(`update vendor_issue set issue_no = 'VI' || lpad(id::text, 5, '0') where id = $1`, [row.id]);
      for (const l of lines) {
        await tm.query(
          `insert into vendor_issue_line (issue_id, purchase_item_id, description, field, billed_value, correct_value, qty, unit_cost, amount) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [row.id, l.purchase_item_id, l.description, l.field, l.billed_value, l.correct_value, l.qty, l.unit_cost, l.amount]);
      }
      return row.id;
    });
    await this.audit.record({ userId: c.id, action: 'vendor_issue.raised', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue raised (${kind.toLowerCase().replace('_', ' ')}): ${summary}`, details: { vendorId: v.id, claimed } });
    return { id };
  }

  async update(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot change this issue.');
    if (q.status !== 'OPEN') throw new BadRequestException('Only an issue that has not gone to the vendor can be edited; add a note instead.');
    const summary = b?.summary !== undefined ? text(b.summary, 200) : q.summary;
    if (!summary) throw new BadRequestException('Give the issue a short summary.');
    const lines = b?.lines !== undefined ? await this.cleanLines(q.kind, b.lines, q.vendor_id, q.invoice_id, q.store_id, true) : null;
    await this.manager.transaction(async tm => {
      if (lines) {
        const [ret] = await tm.query(`select count(*)::int as n from vendor_issue_line where issue_id = $1 and returned_qty > 0`, [id]);
        if (ret.n) throw new BadRequestException('Goods on this issue have already gone back to the vendor, so its lines cannot be replaced.');
        await tm.query(`delete from vendor_issue_line where issue_id = $1`, [id]);
        for (const l of lines) {
          await tm.query(
            `insert into vendor_issue_line (issue_id, purchase_item_id, description, field, billed_value, correct_value, qty, unit_cost, amount) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [id, l.purchase_item_id, l.description, l.field, l.billed_value, l.correct_value, l.qty, l.unit_cost, l.amount]);
        }
      }
      const claimed = lines ? r2(lines.reduce((t, l) => t + l.amount, 0)) : Number(q.claimed_amount);
      await tm.query(`update vendor_issue set summary = $2, details = $3, claimed_amount = $4 where id = $1`, [id, summary, b?.details !== undefined ? text(b.details, 1000) : q.details, claimed]);
    });
    await this.audit.record({ userId: c.id, action: 'vendor_issue.updated', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue ${q.issue_no} changed`, details: {} });
    return { id };
  }

  // ------------------------------------------------------------------ the conversation and the outcome
  async addNote(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot see this issue.');
    const note = text(b?.note, 500);
    if (!note) throw new BadRequestException('Write the note.');
    await this.manager.query(`insert into vendor_issue_note (issue_id, note, created_by) values ($1,$2,$3)`, [id, note, c.id]);
    return { id };
  }

  async send(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot change this issue.');
    if (q.status !== 'OPEN') throw new BadRequestException('This issue has already been sent or closed.');
    const via = String(b?.via || '').toUpperCase();
    if (!VIAS.includes(via)) throw new BadRequestException('Say how it was sent to the vendor.');
    let due = b?.due_on;
    if (!due) { const d = new Date(); d.setUTCDate(d.getUTCDate() + 7); due = d.toISOString().slice(0, 10); }
    if (!DATE.test(due) || due < today()) throw new BadRequestException('The response date cannot be in the past.');
    await this.manager.query(`update vendor_issue set status = 'WITH_VENDOR', sent_on = now(), sent_via = $2, vendor_ref = $3, due_on = $4 where id = $1`, [id, via, text(b?.vendor_ref, 60), due]);
    await this.manager.query(`insert into vendor_issue_note (issue_id, note, created_by) values ($1,$2,$3)`, [id, `Sent to the vendor by ${via.toLowerCase()}${text(b?.vendor_ref, 60) ? ', their reference ' + text(b?.vendor_ref, 60) : ''}; reply due ${due}.`, c.id]);
    await this.audit.record({ userId: c.id, action: 'vendor_issue.sent', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue ${q.issue_no} sent (${via.toLowerCase()})`, details: { due } });
    return { id };
  }

  /** the defective / wrong goods leave the store's stock, once per line */
  async sendGoodsBack(id: number, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot change this issue.');
    if (!GOODS_BACK.includes(q.kind)) throw new BadRequestException('This kind of issue has no goods to send back.');
    if (!['OPEN', 'WITH_VENDOR'].includes(q.status)) throw new BadRequestException('This issue is closed.');
    if (!q.store_id) throw new BadRequestException('The issue has no store, so there is no stock to take the goods from.');
    const lines = await this.manager.query(`select id, purchase_item_id, qty, description from vendor_issue_line where issue_id = $1 and purchase_item_id is not null and qty > 0 and returned_qty = 0`, [id]);
    if (!lines.length) throw new BadRequestException('There are no goods left to send back on this issue.');
    let moved = 0;
    await this.manager.transaction(async tm => {
      for (const l of lines) {
        const [a] = await tm.query(`select (${AVAILABLE_AT_STORE})::int as available from purchase_invoice_item pii join purchase_invoice i on i.id = pii.invoice_id join product p on p.id = pii.product_id where pii.id = $1`, [l.purchase_item_id, q.store_id]);
        if (!a || a.available < l.qty) throw new BadRequestException(`${l.description}: only ${Math.max(a?.available ?? 0, 0)} left in stock at the store, cannot send back ${l.qty}.`);
        const [adj] = await tm.query(
          `insert into product_qtychange (item_id, qty, reason, comments, status, store_id, created_by) values ($1,$2,'RETURNED_TO_VENDOR',$3,'APPROVED',$4,$5) returning id`,
          [l.purchase_item_id, -l.qty, `Vendor issue ${q.issue_no}`, q.store_id, c.id]);
        await tm.query(`update vendor_issue_line set returned_qty = qty, returned_on = now(), adjustment_id = $2 where id = $1`, [l.id, adj.id]);
        moved += l.qty;
      }
      await tm.query(`insert into vendor_issue_note (issue_id, note, created_by) values ($1,$2,$3)`, [id, `${moved} unit${moved === 1 ? '' : 's'} taken out of stock and sent back to the vendor.`, c.id]);
    });
    await this.audit.record({ userId: c.id, action: 'vendor_issue.goods_returned', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue ${q.issue_no}: ${moved} units sent back`, details: { storeId: q.store_id } });
    return { id, moved };
  }

  async resolve(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only the Business Head can close an issue with the vendor.');
    const q = await this.load(id);
    if (!['OPEN', 'WITH_VENDOR'].includes(q.status)) throw new BadRequestException('This issue is already closed.');
    const res = String(b?.resolution || '').toUpperCase();
    if (!RESOLUTIONS.includes(res)) throw new BadRequestException('Choose how the vendor settled it.');
    let amount: number | null = null;
    if (['CREDIT_NOTE', 'REFUND'].includes(res)) {
      amount = r2(Number(b?.credit_amount));
      if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter the amount the vendor is giving back.');
      if (res === 'CREDIT_NOTE' && !text(b?.credit_ref, 60)) throw new BadRequestException('Enter the credit note number.');
    }
    await this.manager.query(
      `update vendor_issue set status = 'RESOLVED', resolution = $2, credit_amount = $3, credit_ref = $4, resolution_note = $5, resolved_by = $6, resolved_on = now() where id = $1`,
      [id, res, amount, text(b?.credit_ref, 60), text(b?.note, 300), c.id]);
    await this.manager.query(`insert into vendor_issue_note (issue_id, note, created_by) values ($1,$2,$3)`, [id, `Settled: ${res.toLowerCase().replace('_', ' ')}${amount ? ' of ' + amount.toFixed(2) : ''}${text(b?.credit_ref, 60) ? ' (' + text(b?.credit_ref, 60) + ')' : ''}.`, c.id]);
    await this.audit.record({ userId: c.id, action: 'vendor_issue.resolved', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue ${q.issue_no} settled: ${res}${amount ? ' ' + amount.toFixed(2) : ''}`, details: { claimed: Number(q.claimed_amount) } });
    return { id };
  }

  async reject(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only the Business Head can close an issue with the vendor.');
    const q = await this.load(id);
    if (!['OPEN', 'WITH_VENDOR'].includes(q.status)) throw new BadRequestException('This issue is already closed.');
    const note = text(b?.note, 300);
    if (!note) throw new BadRequestException('Say why the vendor refused it.');
    await this.manager.query(`update vendor_issue set status = 'REJECTED', resolution_note = $2, resolved_by = $3, resolved_on = now() where id = $1`, [id, note, c.id]);
    await this.manager.query(`insert into vendor_issue_note (issue_id, note, created_by) values ($1,$2,$3)`, [id, `Vendor refused: ${note}`, c.id]);
    await this.audit.record({ userId: c.id, action: 'vendor_issue.rejected', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue ${q.issue_no} refused by the vendor`, details: { note } });
    return { id };
  }

  async cancel(id: number, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot change this issue.');
    if (q.status !== 'OPEN') throw new BadRequestException('Only an issue not yet sent can be cancelled.');
    const [ret] = await this.manager.query(`select count(*)::int as n from vendor_issue_line where issue_id = $1 and returned_qty > 0`, [id]);
    if (ret.n) throw new BadRequestException('Goods have already gone back to the vendor on this issue; it cannot be cancelled.');
    await this.manager.query(`update vendor_issue set status = 'CANCELLED' where id = $1`, [id]);
    await this.audit.record({ userId: c.id, action: 'vendor_issue.cancelled', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue ${q.issue_no} cancelled`, details: {} });
    return { id };
  }

  async reopen(id: number, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only the Business Head can reopen an issue.');
    const q = await this.load(id);
    if (!['RESOLVED', 'REJECTED'].includes(q.status)) throw new BadRequestException('Only a settled or refused issue can be reopened.');
    await this.manager.query(
      `update vendor_issue set status = $2, resolution = null, credit_amount = null, credit_ref = null, resolution_note = null, resolved_by = null, resolved_on = null where id = $1`, [id, q.sent_on ? 'WITH_VENDOR' : 'OPEN']);
    await this.manager.query(`insert into vendor_issue_note (issue_id, note, created_by) values ($1,$2,$3)`, [id, 'Reopened.', c.id]);
    await this.audit.record({ userId: c.id, action: 'vendor_issue.reopened', entityType: 'vendor_issue', entityId: id, summary: `Vendor issue ${q.issue_no} reopened`, details: {} });
    return { id };
  }

  /** how each vendor performs: issues, how long they take, what was recovered */
  async scorecard(user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only the Business Head sees the vendor scorecard.');
    return this.manager.query(
      `select q.vendor_id, v.business_name as vendor, count(*)::int as issues,
              count(*) filter (where q.status in ('OPEN', 'WITH_VENDOR'))::int as open,
              count(*) filter (where q.status = 'WITH_VENDOR' and q.due_on < current_date)::int as overdue,
              count(*) filter (where q.status = 'REJECTED')::int as refused,
              coalesce(sum(q.claimed_amount) filter (where q.status <> 'CANCELLED'), 0)::float as claimed,
              coalesce(sum(q.credit_amount) filter (where q.status = 'RESOLVED'), 0)::float as recovered,
              round(avg(extract(epoch from (q.resolved_on - q.raised_on)) / 86400) filter (where q.status = 'RESOLVED')::numeric, 1)::float as avg_days_to_settle
         from vendor_issue q join vendor v on v.id = q.vendor_id where q.status <> 'CANCELLED' group by q.vendor_id, v.business_name order by count(*) desc, v.business_name`);
  }
}

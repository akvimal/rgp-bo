import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { StoreService } from '../store/store.service';
import { allocateCommitmentReceipts, commitmentBalance, holdDays, istToday } from './commitment-db';
import { Advance, balanceOf, cleanAdvance, cleanLines, refundProblem, statusOf, totalOf } from './commitment-rules';
import { DIGITAL_PROVIDER } from '../sales/digital-payment';

const CASH_ADVANCE = 'COMMITMENT_ADVANCE';
const CASH_REFUND = 'COMMITMENT_REFUND';

/**
 * Customer commitments: an order taken at the counter, paid in advance, bought through the normal purchase flow and collected on a later bill (see
 * docs/planning/CUSTOMER_COMMITMENTS.md). The advance is held against the commitment and counted in the shift it was taken in.
 */
@Injectable()
export class CommitmentService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly store: StoreService,
  ) {}

  // ------------------------------------------------------------------------------------------------------------------ who

  private async roleOf(user: any): Promise<string | null> {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    return role?.name ?? null;
  }

  /** every store for an owner, a person's own stores for anyone else */
  private async scopeOf(user: any): Promise<{ owner: boolean; manager: boolean; stores: number[] }> {
    const name = await this.roleOf(user);
    if (isOwnerRole(name)) return { owner: true, manager: true, stores: [] };
    const mine = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { owner: false, manager: isManagerRole(name), stores: mine.map((m: any) => +m.store_id) };
  }

  private assertStore(scope: { owner: boolean; stores: number[] }, storeId: number | null) {
    if (!scope.owner && (storeId === null || !scope.stores.includes(+storeId))) throw new ForbiddenException('That commitment is at a store you do not work at.');
  }

  // ------------------------------------------------------------------------------------------------------------------ reading

  async list(query: any, user: any) {
    const scope = await this.scopeOf(user);
    const where: string[] = [];
    const params: any[] = [];
    const add = (sql: string, v: any) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    const status = String(query?.status || 'ACTIVE').toUpperCase();
    if (status === 'ACTIVE') where.push(`c.status in ('OPEN', 'ORDERED', 'READY')`);
    else if (status !== 'ALL') add('c.status = ?', status);
    if (query?.storeid) add('c.store_id = ?', Number(query.storeid));
    if (query?.customerid) add('c.customer_id = ?', Number(query.customerid));
    if (!scope.owner) add('c.store_id = any(?::int[])', scope.stores.length ? scope.stores : [0]);
    const q = String(query?.q || '').trim();
    if (q) {
      params.push(q);
      where.push(`(cu.name ilike '%' || $${params.length} || '%' or cu.mobile ilike '%' || $${params.length} || '%')`);
    }
    const rows = await this.manager.query(
      `select c.id, c.status, c.store_id, s.location as store, c.customer_id, cu.name as customer, cu.mobile, to_char(c.needed_by, 'YYYY-MM-DD') as needed_by,
              to_char(c.hold_until, 'YYYY-MM-DD') as hold_until, c.notified_at, c.created_on, c.notes,
              (select coalesce(sum(p.amount), 0)::float from customer_commitment_payment p where p.commitment_id = c.id) as held,
              (select coalesce(sum(l.qty * coalesce(l.agreed_price, 0)), 0)::float from customer_commitment_line l where l.commitment_id = c.id and l.active) as total,
              (select string_agg(coalesce(pr.title, l.requested_name) || ' x' || l.qty, ', ' order by l.id) from customer_commitment_line l left join product pr on pr.id = l.product_id where l.commitment_id = c.id and l.active) as items,
              (select count(*)::int from customer_commitment_line l where l.commitment_id = c.id and l.active and l.qty_received >= l.qty) as lines_in,
              (select count(*)::int from customer_commitment_line l where l.commitment_id = c.id and l.active) as lines
         from customer_commitment c join customer cu on cu.id = c.customer_id left join stores s on s.id = c.store_id
        ${where.length ? 'where ' + where.join(' and ') : ''}
        order by case c.status when 'READY' then 0 when 'ORDERED' then 1 when 'OPEN' then 2 else 3 end, c.needed_by nulls last, c.id desc
        limit 300`, params);
    return rows;
  }

  async get(id: number, user: any) {
    const scope = await this.scopeOf(user);
    const [c] = await this.manager.query(
      `select c.*, to_char(c.needed_by, 'YYYY-MM-DD') as needed_by_text, to_char(c.hold_until, 'YYYY-MM-DD') as hold_until_text, s.location as store,
              cu.name as customer, cu.mobile, u.full_name as created_by_name, nu.full_name as notified_by_name
         from customer_commitment c join customer cu on cu.id = c.customer_id left join stores s on s.id = c.store_id
         left join app_user u on u.id = c.created_by left join app_user nu on nu.id = c.notified_by
        where c.id = $1`, [id]);
    if (!c) throw new NotFoundException('That commitment was not found.');
    this.assertStore(scope, c.store_id);
    const lines = await this.manager.query(
      `select l.id, l.product_id, coalesce(p.title, l.requested_name) as title, p.pack, l.requested_name, l.qty, l.agreed_price::float as agreed_price, l.request_id, l.qty_received,
              pr.status as request_status, pr.fulfilled_qty as request_received
         from customer_commitment_line l left join product p on p.id = l.product_id left join purchase_request pr on pr.id = l.request_id
        where l.commitment_id = $1 and l.active order by l.id`, [id]);
    const payments = await this.manager.query(
      `select p.id, p.kind, p.amount::float as amount, p.mode, p.digi_method, p.digi_provider, p.digi_ref, p.shift_id, sh.name as shift_name, p.sale_id, p.note, p.created_on, u.full_name as by_name
         from customer_commitment_payment p left join store_shifts sh on sh.id = p.shift_id left join app_user u on u.id = p.created_by
        where p.commitment_id = $1 order by p.id`, [id]);
    return {
      id: c.id, status: c.status, storeid: c.store_id, store: c.store, customerid: c.customer_id, customer: c.customer, mobile: c.mobile,
      neededby: c.needed_by_text, holduntil: c.hold_until_text, notifiedat: c.notified_at, notifiedby: c.notified_by_name, notifiednote: c.notified_note,
      notes: c.notes, saleid: c.sale_id, cancelreason: c.cancel_reason, createdon: c.created_on, createdby: c.created_by_name,
      lines, payments, total: totalOf(lines.map((l: any) => ({ qty: l.qty, agreed_price: l.agreed_price }))), held: balanceOf(payments),
      canmanage: scope.manager,
    };
  }

  /** the customer's commitments that are ready to collect, for the till */
  async readyFor(customerId: number, storeId: number | null, user: any) {
    const scope = await this.scopeOf(user);
    const rows = await this.manager.query(
      `select c.id, c.store_id, to_char(c.hold_until, 'YYYY-MM-DD') as hold_until,
              (select coalesce(sum(p.amount), 0)::float from customer_commitment_payment p where p.commitment_id = c.id) as held,
              (select string_agg(coalesce(pr.title, l.requested_name) || ' x' || l.qty, ', ' order by l.id) from customer_commitment_line l left join product pr on pr.id = l.product_id where l.commitment_id = c.id and l.active) as items
         from customer_commitment c where c.customer_id = $1 and c.status = 'READY' and ($2::int is null or c.store_id = $2) order by c.id`, [customerId, storeId]);
    return rows.filter((r: any) => scope.owner || scope.stores.includes(+r.store_id));
  }

  /** open lines for a product that are not on a purchase request yet, so purchasing can see who is waiting (and link them) */
  async waitingFor(productId: number, storeId: number | null, user: any) {
    const scope = await this.scopeOf(user);
    const rows = await this.manager.query(
      `select l.id as line_id, l.qty, l.request_id, c.id as commitment_id, c.store_id, cu.name as customer, cu.mobile, to_char(c.needed_by, 'YYYY-MM-DD') as needed_by
         from customer_commitment_line l join customer_commitment c on c.id = l.commitment_id and c.status in ('OPEN', 'ORDERED')
         join customer cu on cu.id = c.customer_id
        where l.active and l.product_id = $1 and ($2::int is null or c.store_id = $2) order by c.id, l.id`, [productId, storeId]);
    return rows.filter((r: any) => scope.owner || scope.stores.includes(+r.store_id));
  }

  // ------------------------------------------------------------------------------------------------------------------ taking an order

  /** the shift the money is counted in: the store's open one (a person's own in a staff-based store) */
  private async openShift(storeId: number, user: any): Promise<number> {
    const shift = await this.store.findOpenShiftFor(storeId, user.id);
    if (!shift) throw new BadRequestException('Open a shift first: the money taken is counted in the shift that is open.');
    return +shift.id;
  }

  /** the advance as a receipt in the shift it is taken in: cash into that shift's drawer, digital into its provider total */
  private async receive(tm: EntityManager, commitment: { id: number; store_id: number; customer: string }, a: Advance, shiftId: number, user: any) {
    const [p] = await tm.query(
      `insert into customer_commitment_payment (commitment_id, kind, amount, mode, digi_method, digi_provider, digi_ref, shift_id, store_id, note, created_by)
       values ($1, 'RECEIPT', $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [commitment.id, a.amount, a.mode, a.digimethod, a.mode === 'DIGITAL' ? DIGITAL_PROVIDER : null, a.digirefno, shiftId, commitment.store_id, `Advance from ${commitment.customer}`.slice(0, 200), user.id]);
    if (a.mode === 'CASH') {
      await tm.query(
        `insert into store_cash_accounts (trans_date, category, description, deposit, withdraw, store_id, shift_id) values ($1::date, $2, $3, $4, 0, $5, $6)`,
        [istToday(), CASH_ADVANCE, `Advance for commitment #${commitment.id}: ${commitment.customer}`.slice(0, 250), a.amount, commitment.store_id, shiftId]);
    }
    return +p.id;
  }

  async create(body: any, user: any) {
    const scope = await this.scopeOf(user);
    const storeId = Number(body?.storeid || 0);
    if (!storeId) throw new BadRequestException('Choose the store.');
    this.assertStore(scope, storeId);
    const customerId = Number(body?.customerid || 0);
    const [cust] = customerId ? await this.manager.query(`select id, name, mobile from customer where id = $1`, [customerId]) : [null];
    if (!cust || !String(cust.name ?? '').trim() || cust.mobile === '0000000000') throw new BadRequestException('Choose the customer: an order needs a named customer to call.');
    const lines = cleanLines(body?.lines);
    if (!lines.ok) throw new BadRequestException(lines.message);
    let advance: Advance | null = null;
    if (body?.advance && Number(body.advance.amount) > 0) {
      const a = cleanAdvance(body.advance);
      if (!a.ok) throw new BadRequestException(a.message);
      advance = a.value;
    }
    const neededBy = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.neededby || '')) ? String(body.neededby) : null;
    const shiftId = advance ? await this.openShift(storeId, user) : null;
    const id = await this.manager.transaction(async (tm) => {
      const [c] = await tm.query(
        `insert into customer_commitment (store_id, customer_id, needed_by, notes, created_by) values ($1, $2, $3, $4, $5) returning id`,
        [storeId, cust.id, neededBy, String(body?.notes || '').trim().slice(0, 300) || null, user.id]);
      for (const l of lines.value) {
        await tm.query(`insert into customer_commitment_line (commitment_id, product_id, requested_name, qty, agreed_price) values ($1, $2, $3, $4, $5)`, [c.id, l.productid, l.requestedname, l.qty, l.agreedprice]);
      }
      if (advance) await this.receive(tm, { id: +c.id, store_id: storeId, customer: cust.name }, advance, shiftId!, user);
      return +c.id;
    });
    if (shiftId) await this.store.refreshShiftTotals(shiftId);
    await this.audit.record({ userId: user.id, action: 'commitment.created', entityType: 'customer_commitment', entityId: id, summary: `Customer commitment #${id} for ${cust.name}${advance ? `, advance ${advance.amount.toFixed(2)} ${advance.mode.toLowerCase()}` : ''}`, details: { lines: lines.value.length, advance: advance?.amount ?? 0 } });
    return this.get(id, user);
  }

  /** more of the advance, or the balance at collection, taken against an open commitment */
  async addPayment(id: number, body: any, user: any) {
    const c = await this.editable(id, user);
    const a = cleanAdvance(body);
    if (!a.ok) throw new BadRequestException(a.message);
    const shiftId = await this.openShift(+c.store_id, user);
    await this.manager.transaction((tm) => this.receive(tm, { id: +c.id, store_id: +c.store_id, customer: c.customer }, a.value, shiftId, user));
    await this.store.refreshShiftTotals(shiftId);
    await this.audit.record({ userId: user.id, action: 'commitment.payment', entityType: 'customer_commitment', entityId: id, summary: `Advance ${a.value.amount.toFixed(2)} ${a.value.mode.toLowerCase()} taken for commitment #${id}`, details: { amount: a.value.amount, mode: a.value.mode } });
    return this.get(id, user);
  }

  private async editable(id: number, user: any) {
    const scope = await this.scopeOf(user);
    const [c] = await this.manager.query(`select c.id, c.status, c.store_id, cu.name as customer from customer_commitment c join customer cu on cu.id = c.customer_id where c.id = $1`, [id]);
    if (!c) throw new NotFoundException('That commitment was not found.');
    this.assertStore(scope, c.store_id);
    if (c.status === 'COLLECTED' || c.status === 'CANCELLED') throw new ConflictException(`This commitment is ${c.status.toLowerCase()}.`);
    return c;
  }

  // ------------------------------------------------------------------------------------------------------------------ the purchase flow

  /** puts each line that is not on a purchase request on one (a normal request, with the customer named, that purchasing carries on with) */
  async raiseRequests(id: number, user: any) {
    const c = await this.editable(id, user);
    const [head] = await this.manager.query(
      `select cu.name, cu.mobile, c.store_id, to_char(c.needed_by, 'YYYY-MM-DD') as needed_by from customer_commitment c join customer cu on cu.id = c.customer_id where c.id = $1`, [id]);
    const lines = await this.manager.query(`select id, product_id, requested_name, qty from customer_commitment_line where commitment_id = $1 and active and request_id is null order by id`, [id]);
    if (!lines.length) throw new BadRequestException('Every line is already on a purchase request.');
    await this.manager.transaction(async (tm) => {
      // the lines of one commitment are one slip, raised for the store that took the advance
      const [g] = await tm.query(`insert into purchase_request_group (store_id, created_by, note) values ($1, $2, $3) returning id`, [head.store_id, user.id, `Customer commitment #${id}`]);
      for (const l of lines) {
        const [r] = await tm.query(
          `insert into purchase_request (product_id, requested_name, request_type, source, priority, qty, status, customer_name, customer_phone, needed_by, source_ref, comments, created_by, store_id, group_id)
           values ($1, $2, 'Customer', 'Customer commitment', 'High', $3, 'Open', $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
          [l.product_id, l.product_id ? null : l.requested_name, l.qty, head.name, head.mobile, head.needed_by, `commitment:${id}`, `Customer commitment #${id}, advance taken`, user.id, head.store_id, g.id]);
        await tm.query(`update customer_commitment_line set request_id = $2 where id = $1`, [l.id, r.id]);
      }
      await this.refreshStatus(tm, id);
    });
    await this.audit.record({ userId: user.id, action: 'commitment.requested', entityType: 'customer_commitment', entityId: id, summary: `Commitment #${id}: ${lines.length} purchase request${lines.length === 1 ? '' : 's'} raised`, details: { lines: lines.length } });
    return this.get(id, user);
  }

  /** a line goes on a purchase request that is already there (it may bring more than the customers need: the rest is stock) */
  async linkLine(lineId: number, body: any, user: any) {
    const [l] = await this.manager.query(`select l.id, l.commitment_id, l.product_id, l.requested_name, l.qty from customer_commitment_line l where l.id = $1 and l.active`, [lineId]);
    if (!l) throw new NotFoundException('That line was not found.');
    await this.editable(+l.commitment_id, user);
    const requestId = Number(body?.requestid || 0);
    const [r] = await this.manager.query(`select id, product_id, requested_name, status from purchase_request where id = $1 and active and not archive`, [requestId]);
    if (!r) throw new BadRequestException('Choose the purchase request.');
    if (['Cancelled', 'Rejected', 'Closed'].includes(String(r.status))) throw new BadRequestException(`That request is ${String(r.status).toLowerCase()}.`);
    if (l.product_id ? +r.product_id !== +l.product_id : String(r.requested_name || '').toLowerCase() !== String(l.requested_name || '').toLowerCase()) throw new BadRequestException('That request is for another product.');
    await this.manager.transaction(async (tm) => {
      await tm.query(`update customer_commitment_line set request_id = $2 where id = $1`, [lineId, requestId]);
      await this.refreshStatus(tm, +l.commitment_id);
      await allocateCommitmentReceipts(tm, [requestId]);                           // the request may already have been received
    });
    return this.get(+l.commitment_id, user);
  }

  private async refreshStatus(tm: EntityManager, id: number) {
    const [c] = await tm.query(`select status from customer_commitment where id = $1 for update`, [id]);
    const lines = await tm.query(`select request_id, qty_received from customer_commitment_line where commitment_id = $1 and active`, [id]);
    const status = statusOf(c.status, lines);
    if (status !== c.status) await tm.query(`update customer_commitment set status = $2, updated_on = now() where id = $1`, [id, status]);
  }

  // ------------------------------------------------------------------------------------------------------------------ telling the customer, cancelling, refunding

  async notify(id: number, body: any, user: any) {
    const scope = await this.scopeOf(user);
    const [c] = await this.manager.query(`select id, status, store_id from customer_commitment where id = $1`, [id]);
    if (!c) throw new NotFoundException('That commitment was not found.');
    this.assertStore(scope, c.store_id);
    if (c.status !== 'READY') throw new BadRequestException('Nothing has arrived for this commitment yet.');
    await this.manager.query(`update customer_commitment set notified_at = now(), notified_by = $2, notified_note = $3, updated_by = $2, updated_on = now() where id = $1`,
      [id, user.id, String(body?.note || '').trim().slice(0, 200) || null]);
    await this.audit.record({ userId: user.id, action: 'commitment.notified', entityType: 'customer_commitment', entityId: id, summary: `Customer told that commitment #${id} is ready` });
    return this.get(id, user);
  }

  /** pays back what is held: cash from the drawer, digitally through the terminal, or to the customer's wallet (store credit) */
  private async payOut(tm: EntityManager, c: { id: number; store_id: number; customer_id: number; customer: string }, b: any, amount: number, reason: string, user: any): Promise<number | null> {
    const mode = String(b?.mode || '').toUpperCase();
    if (!['CASH', 'DIGITAL', 'WALLET'].includes(mode)) throw new BadRequestException('Choose how it is paid back: cash, digital or to the wallet.');
    let shiftId: number | null = null;
    let ref: string | null = null, method: string | null = null;
    if (mode === 'DIGITAL') {
      const a = cleanAdvance({ amount, mode: 'DIGITAL', digimethod: b?.digimethod, digirefno: b?.digirefno });
      if (!a.ok) throw new BadRequestException(a.message);
      ref = a.value.digirefno; method = a.value.digimethod;
    }
    if (mode !== 'WALLET') shiftId = await this.openShift(c.store_id, user);
    await tm.query(
      `insert into customer_commitment_payment (commitment_id, kind, amount, mode, digi_method, digi_provider, digi_ref, shift_id, store_id, note, created_by)
       values ($1, 'REFUND', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [c.id, -amount, mode, method, mode === 'DIGITAL' ? DIGITAL_PROVIDER : null, ref, shiftId, c.store_id, reason.slice(0, 200), user.id]);
    if (mode === 'CASH') {
      await tm.query(`insert into store_cash_accounts (trans_date, category, description, deposit, withdraw, store_id, shift_id) values ($1::date, $2, $3, 0, $4, $5, $6)`,
        [istToday(), CASH_REFUND, `Advance paid back, commitment #${c.id}: ${c.customer}`.slice(0, 250), amount, c.store_id, shiftId]);
    }
    if (mode === 'WALLET') {
      await tm.query(`insert into customer_credit_entry (customer_id, kind, amount, store_id, note, created_by) values ($1, 'ADJUSTMENT', $2, $3, $4, $5)`,
        [c.customer_id, amount, c.store_id, `Advance moved from commitment #${c.id}`, user.id]);
    }
    return shiftId;
  }

  private async managerOnly(user: any, what: string) {
    const scope = await this.scopeOf(user);
    if (!scope.manager) throw new ForbiddenException(`Only a Store Head or the owner can ${what}.`);
  }

  async refund(id: number, body: any, user: any) {
    await this.managerOnly(user, 'pay back an advance');
    const c = await this.editable(id, user);
    const [full] = await this.manager.query(`select customer_id from customer_commitment where id = $1`, [id]);
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    const reason = String(body?.reason || '').trim();
    if (reason.length < 3) throw new BadRequestException('Say why the advance is paid back.');
    const problem = refundProblem(c.status, await commitmentBalance(this.manager, id), amount);
    if (problem) throw new BadRequestException(problem);
    const shiftId = await this.manager.transaction((tm) => this.payOut(tm, { id, store_id: +c.store_id, customer_id: +full.customer_id, customer: c.customer }, body, amount, reason, user));
    if (shiftId) await this.store.refreshShiftTotals(shiftId);
    await this.audit.record({ userId: user.id, action: 'commitment.refund', entityType: 'customer_commitment', entityId: id, summary: `Advance ${amount.toFixed(2)} of commitment #${id} paid back (${String(body.mode).toLowerCase()})`, details: { amount, mode: body.mode, reason } });
    return this.get(id, user);
  }

  /** cancelling frees the hold; whatever is held is paid back in the same step, so no advance is left on a cancelled order */
  async cancel(id: number, body: any, user: any) {
    const c = await this.editable(id, user);
    const reason = String(body?.reason || '').trim();
    if (reason.length < 3) throw new BadRequestException('Say why it is cancelled.');
    const held = await commitmentBalance(this.manager, id);
    if (held > 0.005) await this.managerOnly(user, 'cancel a commitment that holds an advance');
    const [full] = await this.manager.query(`select customer_id from customer_commitment where id = $1`, [id]);
    let shiftId: number | null = null;
    await this.manager.transaction(async (tm) => {
      if (held > 0.005) shiftId = await this.payOut(tm, { id, store_id: +c.store_id, customer_id: +full.customer_id, customer: c.customer }, body, held, `Cancelled: ${reason}`, user);
      await tm.query(`update customer_commitment set status = 'CANCELLED', cancel_reason = $2, hold_until = null, updated_by = $3, updated_on = now() where id = $1`, [id, reason.slice(0, 200), user.id]);
    });
    if (shiftId) await this.store.refreshShiftTotals(shiftId);
    await this.audit.record({ userId: user.id, action: 'commitment.cancelled', entityType: 'customer_commitment', entityId: id, summary: `Commitment #${id} cancelled${held > 0.005 ? `, ${held.toFixed(2)} paid back` : ''}`, details: { reason, refunded: held } });
    return this.get(id, user);
  }

  /** the hold days a store runs with (shown on the screen) */
  holdDays() { return holdDays(this.manager); }
}

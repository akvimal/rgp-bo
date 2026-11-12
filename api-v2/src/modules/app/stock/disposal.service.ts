import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { approvalModeFor } from 'src/core/approval-mode';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import {
  adjustmentReason, approverProblem, bandOf, canReturnToVendor, ExpiryBand, financialYear, legacySignals, lineValues, METHOD_LABEL, NOT_WASTE_CODES, needsWitness, passNumber, PASS_METHODS, PASS_REASONS, REASON_LABEL, SCHEDULES, SIGNAL_LABEL,
} from './disposal-rules';
import * as ExcelJS from 'exceljs';
import { buildDisposalPdf } from './disposal-pdf';

type Ctx = { id: number; role: string; stores: number[]; isOwner: boolean; isManager: boolean };

const text = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const today = () => new Date().toISOString().slice(0, 10);

/** what the store holds of a batch on its books: received here, less sold here, plus the approved adjustments and transfers posted here (the same sum billing uses) */
export const bookSql = (store: string) => `(
    (case when i.store_id = ${store} then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
    - coalesce((select sum(si.qty) from sale_item si inner join sale s on s.id = si.sale_id
                 where si.purchase_item_id = pii.id and si.active = true and si.archive = false and s.store_id = ${store}), 0)
    + coalesce((select sum(pq.qty) from product_qtychange pq
                 where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active = true and pq.archive = false and pq.store_id = ${store}), 0))`;

/** the quantity of a batch held by approved out-passes of the store (optionally leaving one pass out): on the books, not saleable */
const heldSql = (store: string, except = '0') => `coalesce((select sum(l.qty) from disposal_pass_line l inner join disposal_pass dp on dp.id = l.pass_id
                 where l.item_id = pii.id and dp.status = 'APPROVED' and dp.store_id = ${store} and dp.id <> ${except}), 0)`;

/**
 * Out-passes for goods that leave the shop as waste, and the expiry list they start from. A pass is made (waiting for a Store Head or Business Head), approved
 * (the quantity is held: still on the books, no longer saleable), then confirmed when the goods are handed over or destroyed: that is when the stock drops, one
 * adjustment per line linked to the pass, and Schedule H / H1 / X lines go in the disposal register.
 */
@Injectable()
export class DisposalService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------ who
  private async ctx(user: any): Promise<Ctx> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    const role = r?.name || '';
    return { id: user.id, role, stores: s.map((x: any) => +x.store_id), isOwner: isOwnerRole(role), isManager: isManagerRole(role) };
  }

  private assertStore(c: Ctx, storeId: number) {
    if (!c.isOwner && !c.stores.includes(storeId)) throw new ForbiddenException('That store is not yours to work in.');
  }

  private async business(storeId: number): Promise<number> {
    const [s] = await this.manager.query(`select business_id from stores where id = $1`, [storeId]);
    if (!s?.business_id) throw new BadRequestException('That store was not found.');
    return +s.business_id;
  }

  // ------------------------------------------------------------------ the expiry list
  /** the batches of a store that are expired or near expiry, with what is on the books and what is held, and whether their vendor takes them back */
  async expiry(q: any, user: any) {
    const c = await this.ctx(user);
    let store = Number(q?.storeid) > 0 ? Number(q.storeid) : null;
    if (!store) {
      if (c.stores.length === 1) store = c.stores[0];
      else throw new BadRequestException('Choose a store first.');
    }
    this.assertStore(c, store);
    const rows = await this.manager.query(
      `select * from (
         select pii.id as item_id, pii.product_id, p.title, nullif(p.more_props->>'schedule', '') as schedule, pii.batch, to_char(pii.exp_date, 'YYYY-MM-DD') as exp_date,
                ${bookSql('$1')}::int as balance, ${heldSql('$1')}::int as held, coalesce(p.pack, 1) as pack, pii.ptr_value::float as ptr_value, coalesce(pii.tax_pcnt, 0)::float as tax_pcnt, pii.mrp_cost::float as mrp_cost,
                v.id as vendor_id, v.business_name as vendor_name, v.takes_back, v.takeback_days
           from purchase_invoice_item pii inner join purchase_invoice i on i.id = pii.invoice_id inner join product p on p.id = pii.product_id left join vendor v on v.id = i.vendor_id
          where pii.status = 'VERIFIED' and pii.active = true and pii.archive = false and pii.exp_date is not null and public.expiry_end(pii.exp_date) < current_date + 180) x
       where x.balance > 0 order by x.exp_date, x.title`, [store]);
    const t = today();
    const items = rows.map((r: any) => {
      const band = bandOf(r.exp_date, t) as ExpiryBand;
      const v = lineValues(r.balance, r.pack, r.ptr_value, r.tax_pcnt, r.mrp_cost);
      return {
        itemid: r.item_id, productid: r.product_id, title: r.title, schedule: r.schedule, batch: r.batch, expdate: r.exp_date, band,
        balance: r.balance, held: r.held, sellable: Math.max(0, r.balance - r.held), value: v.cost, vendorid: r.vendor_id, vendor: r.vendor_name || null,
        takesback: r.takes_back || 'NONE', takebackdays: r.takeback_days, canreturn: canReturnToVendor({ takesback: r.takes_back, takebackdays: r.takeback_days }, r.exp_date, t),
      };
    });
    const count = (b: ExpiryBand) => items.filter((i: any) => i.band === b).length;
    const band = String(q?.band || '').toUpperCase();
    return {
      storeid: store,
      counts: { EXPIRED: count('EXPIRED'), D30: count('D30'), D90: count('D90'), D180: count('D180') },
      items: (['EXPIRED', 'D30', 'D90', 'D180'] as string[]).includes(band) ? items.filter((i: any) => i.band === band) : items,
    };
  }

  // ------------------------------------------------------------------ the pass
  /** the lines asked for, checked against what the store can spare (books less what other passes hold), with their values */
  private async priceLines(m: EntityManager, storeId: number, asked: any[], exceptPass: number) {
    if (!Array.isArray(asked) || !asked.length) throw new BadRequestException('Choose at least one batch.');
    const ids = asked.map((l) => Number(l?.itemid));
    if (ids.some((n) => !(n > 0)) || new Set(ids).size !== ids.length) throw new BadRequestException('Each batch can be on a pass once.');
    const rows = await m.query(
      `select pii.id as item_id, pii.product_id, p.title, nullif(p.more_props->>'schedule', '') as schedule, pii.batch, to_char(pii.exp_date, 'YYYY-MM-DD') as exp_date,
              ${bookSql('$2')}::int as balance, ${heldSql('$2', '$3')}::int as held, coalesce(p.pack, 1) as pack, pii.ptr_value::float as ptr_value, coalesce(pii.tax_pcnt, 0)::float as tax_pcnt, pii.mrp_cost::float as mrp_cost
         from purchase_invoice_item pii inner join purchase_invoice i on i.id = pii.invoice_id inner join product p on p.id = pii.product_id
        where pii.id = any($1::int[]) and pii.status = 'VERIFIED' and pii.active = true and pii.archive = false`, [ids, storeId, exceptPass]);
    const byId = new Map<number, any>(rows.map((r: any) => [+r.item_id, r]));
    return asked.map((l) => {
      const r = byId.get(Number(l.itemid));
      if (!r) throw new BadRequestException('A batch on the list was not found.');
      const qty = Math.floor(Number(l.qty));
      if (!(qty >= 1)) throw new BadRequestException(`Give the quantity of ${r.title} (batch ${r.batch || '-'}).`);
      const spare = r.balance - r.held;
      if (qty > spare) throw new BadRequestException(`${r.title} (batch ${r.batch || '-'}): only ${Math.max(0, spare)} can go${r.held ? ` (${r.held} is held by another out-pass)` : ''}.`);
      const v = lineValues(qty, r.pack, r.ptr_value, r.tax_pcnt, r.mrp_cost);
      const sch = String(r.schedule || '').toUpperCase();
      return { itemid: +r.item_id, productid: +r.product_id, title: r.title, batch: r.batch, expdate: r.exp_date, schedule: (SCHEDULES as readonly string[]).includes(sch) ? sch : null, qty, cost: v.cost, tax: v.tax, mrp: v.mrp };
    });
  }

  private fields(b: any) {
    const reason = String(b?.reason || '').toUpperCase();
    const method = String(b?.method || '').toUpperCase();
    if (!(PASS_REASONS as readonly string[]).includes(reason)) throw new BadRequestException('Say why the goods are going: expired, near expiry or damaged.');
    if (!(PASS_METHODS as readonly string[]).includes(method)) throw new BadRequestException('Say how they are going: destroyed, to a disposal agency, back to the vendor, or other.');
    const agency = text(b?.agency, 120);
    if (method === 'AGENCY' && !agency) throw new BadRequestException('Name the disposal agency.');
    return { reason, method, agency, notes: text(b?.notes, 300), evidence: text(b?.evidence_path, 300) };
  }

  async create(b: any, user: any) {
    const c = await this.ctx(user);
    const storeId = Number(b?.storeid);
    if (!(storeId > 0)) throw new BadRequestException('Choose the store.');
    this.assertStore(c, storeId);
    const f = this.fields(b);
    const businessId = await this.business(storeId);
    // a pass made from a stock audit names it: the audit must be one of this store's
    let auditId: number | null = null;
    if (Number(b?.auditid) > 0) {
      const [au] = await this.manager.query(`select id from stock_audit where id = $1 and store_id = $2`, [Number(b.auditid), storeId]);
      if (!au) throw new BadRequestException('That audit is not one of this store\'s.');
      auditId = au.id;
    }
    const id = await this.manager.transaction(async (m) => {
      await m.query(`select pg_advisory_xact_lock($1)`, [businessId]);
      const lines = await this.priceLines(m, storeId, b?.lines, 0);
      const year = new Date().getFullYear();
      const [{ seq }] = await m.query(`select coalesce(max(seq), 0) + 1 as seq from disposal_pass where business_id = $1 and pass_year = $2`, [businessId, year]);
      const [p] = await m.query(
        `insert into disposal_pass (business_id, store_id, pass_year, seq, pass_no, status, reason, method, agency, notes, evidence_path, prepared_by, audit_id)
         values ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12) returning id`,
        [businessId, storeId, year, seq, passNumber(year, +seq), f.reason, f.method, f.agency, f.notes, f.evidence, c.id, auditId]);
      await this.insertLines(m, p.id, lines);
      return p.id as number;
    });
    await this.audit.record({ userId: c.id, action: 'disposal.created', entityType: 'disposal_pass', entityId: id, summary: `Out-pass raised for store ${storeId}`, details: { reason: f.reason, method: f.method } });
    return this.get(id, user);
  }

  private async insertLines(m: EntityManager, passId: number, lines: any[]) {
    for (const l of lines) {
      await m.query(
        `insert into disposal_pass_line (pass_id, item_id, product_id, title, batch, exp_date, schedule, qty, cost_value, tax_value, mrp_value) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [passId, l.itemid, l.productid, l.title, l.batch, l.expdate, l.schedule, l.qty, l.cost, l.tax, l.mrp]);
    }
  }

  private async load(id: number, m: EntityManager = this.manager, lock = false) {
    const [p] = await m.query(`select * from disposal_pass where id = $1 ${lock ? 'for update' : ''}`, [id]);
    if (!p) throw new NotFoundException('That out-pass was not found.');
    return p;
  }

  /** a pass the person may look at: an owner any, others those of their stores */
  private async visible(id: number, c: Ctx) {
    const p = await this.load(id);
    this.assertStore(c, +p.store_id);
    return p;
  }

  async update(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const p = await this.visible(id, c);
    if (p.status !== 'DRAFT') throw new BadRequestException('Only an out-pass waiting for approval can be changed.');
    if (!c.isManager && p.prepared_by !== c.id) throw new ForbiddenException('You can change only the out-passes you made.');
    const f = this.fields({ ...p, ...b, evidence_path: b?.evidence_path !== undefined ? b.evidence_path : p.evidence_path });
    await this.manager.transaction(async (m) => {
      await m.query(`select pg_advisory_xact_lock($1)`, [+p.business_id]);
      await m.query(`update disposal_pass set reason=$2, method=$3, agency=$4, notes=$5, evidence_path=$6 where id=$1`, [id, f.reason, f.method, f.agency, f.notes, f.evidence]);
      if (Array.isArray(b?.lines)) {
        const lines = await this.priceLines(m, +p.store_id, b.lines, id);
        await m.query(`delete from disposal_pass_line where pass_id = $1`, [id]);
        await this.insertLines(m, id, lines);
      }
    });
    return this.get(id, user);
  }

  async approve(id: number, user: any) {
    const c = await this.ctx(user);
    const p = await this.visible(id, c);
    if (p.status !== 'DRAFT') throw new BadRequestException(`This out-pass is already ${String(p.status).toLowerCase()}.`);
    const mode = await approvalModeFor(this.manager, { storeId: +p.store_id, userId: c.id });
    const problem = approverProblem({ role: c.role, isOwner: c.isOwner, isManager: c.isManager, storeIsMine: c.stores.includes(+p.store_id), isMaker: p.prepared_by === c.id, selfMode: mode === 'self' });
    if (problem) throw new ForbiddenException(problem);
    await this.manager.transaction(async (m) => {
      await m.query(`select pg_advisory_xact_lock($1)`, [+p.business_id]);
      // what is held by the others plus this pass must still fit the books
      const lines = await m.query(`select item_id, qty from disposal_pass_line where pass_id = $1`, [id]);
      await this.priceLines(m, +p.store_id, lines.map((l: any) => ({ itemid: l.item_id, qty: l.qty })), id);
      await m.query(`update disposal_pass set status = 'APPROVED', approved_by = $2, approved_on = now() where id = $1`, [id, c.id]);
    });
    await this.audit.record({ userId: c.id, action: 'disposal.approved', entityType: 'disposal_pass', entityId: id, summary: `Out-pass ${p.pass_no} approved: the quantity is held until the goods are handed over`, details: {} });
    return this.get(id, user);
  }

  async reject(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const p = await this.visible(id, c);
    if (p.status !== 'DRAFT') throw new BadRequestException(`This out-pass is already ${String(p.status).toLowerCase()}.`);
    const mode = await approvalModeFor(this.manager, { storeId: +p.store_id, userId: c.id });
    const problem = approverProblem({ role: c.role, isOwner: c.isOwner, isManager: c.isManager, storeIsMine: c.stores.includes(+p.store_id), isMaker: false, selfMode: mode === 'self' });
    if (problem) throw new ForbiddenException(problem.replace('approve', 'reject'));
    const note = text(b?.note, 200);
    if (!note || note.length < 3) throw new BadRequestException('Say why it is rejected.');
    await this.manager.query(`update disposal_pass set status = 'REJECTED', approved_by = $2, approved_on = now(), decision_note = $3 where id = $1`, [id, c.id, note]);
    await this.audit.record({ userId: c.id, action: 'disposal.rejected', entityType: 'disposal_pass', entityId: id, summary: `Out-pass ${p.pass_no} rejected: ${note}`, details: {} });
    return this.get(id, user);
  }

  /** the person who made it, or a manager, withdraws a pass that is waiting or approved (the hold is released); a confirmed one cannot be undone */
  async cancel(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const p = await this.visible(id, c);
    if (!['DRAFT', 'APPROVED'].includes(p.status)) throw new BadRequestException(`This out-pass is already ${String(p.status).toLowerCase()}.`);
    if (!c.isManager && p.prepared_by !== c.id) throw new ForbiddenException('You can cancel only the out-passes you made.');
    await this.manager.query(`update disposal_pass set status = 'CANCELLED', decision_note = coalesce($2, decision_note) where id = $1`, [id, text(b?.note, 200)]);
    await this.audit.record({ userId: c.id, action: 'disposal.cancelled', entityType: 'disposal_pass', entityId: id, summary: `Out-pass ${p.pass_no} cancelled`, details: {} });
    return this.get(id, user);
  }

  /**
   * The goods have been handed over or destroyed: the stock drops (one adjustment per line, linked to the pass) and scheduled drugs go in the disposal register.
   * A Schedule H, H1 or X line confirmed by someone who is not a Store Head or Business Head needs a second staff member as witness.
   */
  async confirm(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const p0 = await this.visible(id, c);
    const handedOn = b?.handed_on ? String(b.handed_on).slice(0, 10) : today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(handedOn) || handedOn > today()) throw new BadRequestException('The day the goods left cannot be in the future.');
    const evidence = text(b?.evidence_path, 300);
    await this.manager.transaction(async (m) => {
      await m.query(`select pg_advisory_xact_lock($1)`, [+p0.business_id]);
      const p = await this.load(id, m, true);
      if (p.status !== 'APPROVED') throw new BadRequestException(p.status === 'CONFIRMED' ? 'This out-pass is already confirmed.' : 'Only an approved out-pass can be confirmed.');
      const lines = await m.query(`select * from disposal_pass_line where pass_id = $1 order by id`, [id]);
      let witnessId: number | null = null;
      if (needsWitness(lines, c.isManager)) {
        witnessId = Number(b?.witness_id) > 0 ? Number(b.witness_id) : null;
        if (!witnessId) throw new BadRequestException('A scheduled drug (H, H1 or X) needs a second staff member as witness.');
        if (witnessId === c.id) throw new BadRequestException('The witness must be someone other than the person confirming.');
        const [w] = await m.query(`select 1 from user_stores us inner join app_user u on u.id = us.user_id where us.user_id = $1 and us.store_id = $2 and us.active and not us.archive and u.active`, [witnessId, +p.store_id]);
        if (!w) throw new BadRequestException('The witness must be a staff member of this store.');
      } else if (Number(b?.witness_id) > 0 && Number(b.witness_id) !== c.id) {
        witnessId = Number(b.witness_id);                                   // a witness offered although not required is kept
      }
      // the books must still hold what is going (this pass's own hold is not counted against it)
      await this.priceLines(m, +p.store_id, lines.map((l: any) => ({ itemid: l.item_id, qty: l.qty })), id);
      await this.postLines(m, p, lines, c.id, handedOn, witnessId);
      await m.query(
        `update disposal_pass set status = 'CONFIRMED', confirmed_by = $2, confirmed_on = now(), handed_on = $3, witness_id = $4, evidence_path = coalesce($5, evidence_path) where id = $1`,
        [id, c.id, handedOn, witnessId, evidence]);
    });
    const p = await this.load(id);
    await this.audit.record({ userId: c.id, action: 'disposal.confirmed', entityType: 'disposal_pass', entityId: id, summary: `Out-pass ${p.pass_no} confirmed: goods handed over, stock reduced`, details: { handedOn } });
    return this.get(id, user);
  }

  /** the stock adjustment for each line of a pass whose goods are gone (linked to the pass), and the disposal register entry of a scheduled drug */
  private async postLines(m: EntityManager, p: any, lines: any[], userId: number, handedOn: string, witnessId: number | null) {
    const code = adjustmentReason(p.reason, p.method);
    for (const l of lines) {
      const [adj] = await m.query(
        `insert into product_qtychange (item_id, qty, reason, reason_code, status, comments, store_id, discarded, created_by, disposal_pass_id)
         values ($1, $2, $3, $4, 'APPROVED', $5, $6, $7, $8, $9) returning id`,
        [l.item_id, -l.qty, code, code, `Out-pass ${p.pass_no}: ${REASON_LABEL[p.reason]}, ${METHOD_LABEL[p.method]}${p.legacy ? ' (disposed earlier, recorded now)' : ''}`, +p.store_id, code !== 'RETURNED_TO_VENDOR', userId, p.id]);
      await m.query(`update disposal_pass_line set qtychange_id = $2 where id = $1`, [l.id, adj.id]);
      if (l.schedule) {
        const [{ serial }] = await m.query(`select coalesce(max(serial_no), 0) + 1 as serial from schedule_disposal_register where business_id = $1 and schedule = $2`, [+p.business_id, l.schedule]);
        await m.query(
          `insert into schedule_disposal_register (business_id, store_id, schedule, serial_no, pass_id, pass_line_id, handed_on, drug_name, batch, exp_date, qty, reason, method, agency, confirmed_by, witness_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [+p.business_id, +p.store_id, l.schedule, serial, p.id, l.id, handedOn, l.title, l.batch, l.exp_date, l.qty, p.reason, p.method, p.agency, userId, witnessId]);
      }
    }
  }

  // ------------------------------------------------------------------ the backlog: expired stock the books still hold
  /**
   * Expired stock that was thrown away long ago but is still on the books: one out-pass, marked "disposed earlier, recorded now", made and confirmed in one step
   * by a Store Head or Business Head. The day the goods left is given (it cannot be in the future); no witness or evidence is asked for. With no lines named, every
   * expired batch of the store that still has stock goes on it.
   */
  async backlog(b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.isManager) throw new ForbiddenException('Only a Store Head or a Business Head can record goods disposed earlier.');
    const storeId = Number(b?.storeid);
    if (!(storeId > 0)) throw new BadRequestException('Choose the store.');
    this.assertStore(c, storeId);
    const handedOn = String(b?.handed_on || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(handedOn) || handedOn > today()) throw new BadRequestException('Give the day the goods were disposed of (not in the future).');
    const f = this.fields({ reason: b?.reason || 'EXPIRED', method: b?.method || 'OTHER', agency: b?.agency, notes: b?.notes, evidence_path: null });
    const businessId = await this.business(storeId);
    const id = await this.manager.transaction(async (m) => {
      await m.query(`select pg_advisory_xact_lock($1)`, [businessId]);
      let asked = Array.isArray(b?.lines) ? b.lines : null;
      if (!asked) {
        const all = await this.expiry({ storeid: storeId, band: 'EXPIRED' }, user);
        asked = all.items.filter((i: any) => i.sellable > 0).map((i: any) => ({ itemid: i.itemid, qty: i.sellable }));
      }
      if (!asked.length) throw new BadRequestException('There is no expired stock on the books to record.');
      const lines = await this.priceLines(m, storeId, asked, 0);
      const year = new Date().getFullYear();
      const [{ seq }] = await m.query(`select coalesce(max(seq), 0) + 1 as seq from disposal_pass where business_id = $1 and pass_year = $2`, [businessId, year]);
      const [p] = await m.query(
        `insert into disposal_pass (business_id, store_id, pass_year, seq, pass_no, status, reason, method, agency, notes, prepared_by, approved_by, approved_on, confirmed_by, confirmed_on, handed_on, legacy)
         values ($1,$2,$3,$4,$5,'CONFIRMED',$6,$7,$8,$9,$10,$10,now(),$10,now(),$11,true) returning *`,
        [businessId, storeId, year, seq, passNumber(year, +seq), f.reason, f.method, f.agency, f.notes || 'Disposed earlier, recorded now', c.id, handedOn]);
      await this.insertLines(m, p.id, lines);
      const saved = await m.query(`select * from disposal_pass_line where pass_id = $1 order by id`, [p.id]);
      await this.postLines(m, p, saved, c.id, handedOn, null);
      return p.id as number;
    });
    await this.audit.record({ userId: c.id, action: 'disposal.backlog', entityType: 'disposal_pass', entityId: id, summary: `Expired stock recorded as disposed earlier (${handedOn})`, details: { storeId } });
    return this.get(id, user);
  }

  // ------------------------------------------------------------------ the old write-offs
  /** the stores a person may look at: an owner the business's, anyone else their own */
  private async scopeStores(c: Ctx, storeId: number | null): Promise<number[]> {
    let stores: number[];
    if (c.isOwner) stores = (await this.manager.query(`select id from stores where business_id = $1`, [await this.ownBusiness(c.id)])).map((r: any) => +r.id);
    else stores = c.stores;
    if (storeId) { if (!stores.includes(storeId)) throw new ForbiddenException('That store is not yours to work in.'); return [storeId]; }
    return stores;
  }

  /**
   * Adjustments made before out-passes existed that look like expiry write-offs (by their reason, their batch's expiry on the day, or their words), with whether a
   * person has confirmed them as expiry or not. Reading only: tagging is a separate step.
   */
  async legacyList(q: any, user: any) {
    const c = await this.ctx(user);
    const storeId = Number(q?.storeid) > 0 ? Number(q.storeid) : null;
    const stores = await this.scopeStores(c, storeId);
    if (!stores.length) return { rows: [], counts: { UNREVIEWED: 0, EXPIRY: 0, NOT_EXPIRY: 0 } };
    const rows = await this.manager.query(
      `select q.id, to_char(q.created_on, 'YYYY-MM-DD') as adjusted_on, q.store_id, s.location as store, q.item_id, (-q.qty)::int as qty, q.reason, q.reason_code, q.comments, q.expiry_tag,
              pii.batch, to_char(pii.exp_date, 'YYYY-MM-DD') as exp_date, p.title, coalesce(p.pack, 1) as pack, pii.ptr_value::float as ptr_value, coalesce(pii.tax_pcnt, 0)::float as tax_pcnt
         from product_qtychange q inner join purchase_invoice_item pii on pii.id = q.item_id inner join product p on p.id = pii.product_id left join stores s on s.id = q.store_id
        where q.qty < 0 and coalesce(q.status, 'APPROVED') = 'APPROVED' and q.active = true and q.archive = false and q.disposal_pass_id is null and q.store_id = any($1::int[])
          and coalesce(upper(q.reason_code), '') <> all($2::text[])
        order by q.created_on desc limit 5000`, [stores, NOT_WASTE_CODES]);
    const all = rows.map((r: any) => {
      const signals = legacySignals({ qty: -r.qty, reasonCode: r.reason_code, reason: r.reason, comments: r.comments, expDate: r.exp_date, adjustedOn: r.adjusted_on });
      const v = lineValues(r.qty, r.pack, r.ptr_value, r.tax_pcnt, 0);
      return { id: r.id, adjustedon: r.adjusted_on, storeid: r.store_id, store: r.store, title: r.title, batch: r.batch, expdate: r.exp_date, qty: r.qty, reason: r.reason_code || r.reason, comments: r.comments, tag: r.expiry_tag || null,
        signals, signaltext: signals.map((x) => SIGNAL_LABEL[x]), cost: v.cost, tax: v.tax };
    }).filter((r: any) => r.signals.length);
    const counts = { UNREVIEWED: all.filter((r: any) => !r.tag).length, EXPIRY: all.filter((r: any) => r.tag === 'EXPIRY').length, NOT_EXPIRY: all.filter((r: any) => r.tag === 'NOT_EXPIRY').length };
    const want = String(q?.status || '').toUpperCase();
    const shown = want === 'UNREVIEWED' ? all.filter((r: any) => !r.tag) : want === 'EXPIRY' || want === 'NOT_EXPIRY' ? all.filter((r: any) => r.tag === want) : all;
    return { rows: shown.slice(0, 1000), counts };
  }

  /** a Store Head or Business Head confirms old adjustments as expiry write-offs, or says they are not (or clears the tag): the adjustment itself never changes */
  async legacyTag(b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.isManager) throw new ForbiddenException('Only a Store Head or a Business Head can review old write-offs.');
    const ids = (Array.isArray(b?.ids) ? b.ids : []).map((n: any) => Number(n)).filter((n: number) => n > 0);
    if (!ids.length) throw new BadRequestException('Choose the adjustments first.');
    const tag = b?.tag === null || b?.tag === '' || b?.tag === undefined ? null : String(b.tag).toUpperCase();
    if (tag !== null && tag !== 'EXPIRY' && tag !== 'NOT_EXPIRY') throw new BadRequestException('Say whether they are expiry, or not.');
    const stores = await this.scopeStores(c, null);
    const res: any = await this.manager.query(
      `update product_qtychange set expiry_tag = $2::varchar, expiry_tagged_by = $3, expiry_tagged_on = case when $2::varchar is null then null else now() end
        where id = any($1::int[]) and qty < 0 and disposal_pass_id is null and store_id = any($4::int[]) returning id`, [ids, tag, c.id, stores]);
    const done: any[] = Array.isArray(res?.[0]) ? res[0] : res;                       // an UPDATE ... RETURNING answers [rows, count]
    await this.audit.record({ userId: c.id, action: 'disposal.legacy_tag', entityType: 'product_qtychange', entityId: ids[0], summary: `${done.length} old write-off${done.length === 1 ? '' : 's'} ${tag ? `marked ${tag === 'EXPIRY' ? 'as expiry' : 'as not expiry'}` : 'cleared'}`, details: { count: done.length, tag } });
    return { tagged: done.length, tag };
  }

  // ------------------------------------------------------------------ the statement
  /**
   * What was written off as expired, by month and financial year, for the audit and the CA: confirmed out-passes (the goods left through a pass), out-passes recorded
   * as disposed earlier, and old adjustments a person confirmed as expiry. Value at cost before GST, with the GST paid on that cost.
   */
  async statement(q: any, user: any) {
    const c = await this.ctx(user);
    const storeId = Number(q?.storeid) > 0 ? Number(q.storeid) : null;
    const stores = await this.scopeStores(c, storeId);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(q?.from || '')) ? String(q.from) : '1970-01-01';
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(q?.to || '')) ? String(q.to) : today();
    const rows = stores.length ? await this.manager.query(
      `select to_char(day, 'YYYY-MM') as month, source, count(*)::int as lines, sum(qty)::int as qty, round(sum(cost)::numeric, 2)::float as cost, round(sum(tax)::numeric, 2)::float as tax, min(to_char(day, 'YYYY-MM-DD')) as first_day from (
         select dp.handed_on as day, case when dp.legacy then 'LEGACY_PASS' else 'PASS' end as source, l.qty, l.cost_value as cost, l.tax_value as tax
           from disposal_pass_line l inner join disposal_pass dp on dp.id = l.pass_id
          where dp.status = 'CONFIRMED' and dp.reason in ('EXPIRED', 'NEAR_EXPIRY') and dp.method <> 'VENDOR' and dp.store_id = any($1::int[]) and dp.handed_on between $2::date and $3::date
         union all
         select q.created_on::date as day, 'TAGGED' as source, (-q.qty) as qty,
                (-q.qty) * pii.ptr_value / greatest(coalesce(p.pack, 1), 1) as cost, (-q.qty) * pii.ptr_value / greatest(coalesce(p.pack, 1), 1) * coalesce(pii.tax_pcnt, 0) / 100 as tax
           from product_qtychange q inner join purchase_invoice_item pii on pii.id = q.item_id inner join product p on p.id = pii.product_id
          where q.expiry_tag = 'EXPIRY' and q.qty < 0 and q.disposal_pass_id is null and q.store_id = any($1::int[]) and q.created_on::date between $2::date and $3::date) t
       group by 1, 2 order by 1, 2`, [stores, from, to]) : [];
    const label: Record<string, string> = { PASS: 'Out-passes', LEGACY_PASS: 'Recorded as disposed earlier', TAGGED: 'Old write-offs confirmed as expiry' };
    const lines = rows.map((r: any) => ({ month: r.month, fy: financialYear(r.first_day), source: r.source, sourcelabel: label[r.source], lines: r.lines, qty: r.qty, cost: r.cost, tax: r.tax }));
    const fy = new Map<string, { fy: string; qty: number; cost: number; tax: number }>();
    for (const l of lines) {
      const x = fy.get(l.fy) || { fy: l.fy, qty: 0, cost: 0, tax: 0 };
      x.qty += l.qty; x.cost = Math.round((x.cost + l.cost) * 100) / 100; x.tax = Math.round((x.tax + l.tax) * 100) / 100;
      fy.set(l.fy, x);
    }
    const total = lines.reduce((t: any, l: any) => ({ qty: t.qty + l.qty, cost: Math.round((t.cost + l.cost) * 100) / 100, tax: Math.round((t.tax + l.tax) * 100) / 100 }), { qty: 0, cost: 0, tax: 0 });
    return { from, to, rows: lines, byYear: Array.from(fy.values()).sort((a, b) => a.fy.localeCompare(b.fy)), total };
  }

  async statementXlsx(q: any, user: any): Promise<Buffer> {
    const st = await this.statement(q, user);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Expiry write-offs');
    ws.addRow([`Expiry write-off statement, ${st.from} to ${st.to}`]).font = { bold: true };
    ws.addRow(['Value at cost before GST; GST is the tax paid on that cost.']);
    ws.addRow([]);
    ws.addRow(['Financial year', 'Month', 'Source', 'Lines', 'Units', 'At cost', 'GST on cost']).font = { bold: true };
    st.rows.forEach((r: any) => ws.addRow([r.fy, r.month, r.sourcelabel, r.lines, r.qty, r.cost, r.tax]));
    ws.addRow([]);
    ws.addRow(['By financial year']).font = { bold: true };
    st.byYear.forEach((y: any) => ws.addRow([y.fy, '', '', '', y.qty, y.cost, y.tax]));
    ws.addRow(['Total', '', '', '', st.total.qty, st.total.cost, st.total.tax]).font = { bold: true };
    [14, 10, 36, 8, 8, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ------------------------------------------------------------------ reading
  async list(q: any, user: any) {
    const c = await this.ctx(user);
    const where: string[] = [];
    const args: any[] = [];
    if (!c.isOwner) { args.push(c.stores); where.push(`dp.store_id = any($${args.length}::int[])`); }
    else { args.push(await this.ownBusiness(c.id)); where.push(`dp.business_id = $${args.length}`); }
    if (Number(q?.storeid) > 0) { args.push(Number(q.storeid)); where.push(`dp.store_id = $${args.length}`); }
    const status = String(q?.status || '').toUpperCase();
    if (['DRAFT', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED'].includes(status)) { args.push(status); where.push(`dp.status = $${args.length}`); }
    const rows = await this.manager.query(
      `select dp.id, dp.pass_no, dp.status, dp.reason, dp.method, dp.store_id, s.location as store, dp.prepared_on, dp.approved_on, dp.confirmed_on, dp.handed_on, dp.legacy,
              u.full_name as prepared_by_name, (select count(*) from disposal_pass_line l where l.pass_id = dp.id)::int as lines,
              (select coalesce(sum(l.qty), 0) from disposal_pass_line l where l.pass_id = dp.id)::int as qty,
              (select coalesce(sum(l.cost_value), 0) from disposal_pass_line l where l.pass_id = dp.id)::float as cost_value,
              (select coalesce(sum(l.tax_value), 0) from disposal_pass_line l where l.pass_id = dp.id)::float as tax_value,
              exists (select 1 from disposal_pass_line l where l.pass_id = dp.id and l.schedule is not null) as scheduled
         from disposal_pass dp inner join stores s on s.id = dp.store_id left join app_user u on u.id = dp.prepared_by
        where ${where.join(' and ')} order by dp.id desc limit 300`, args);
    return { rows };
  }

  private async ownBusiness(userId: number): Promise<number> {
    const [r] = await this.manager.query(`select s.business_id from user_stores us inner join stores s on s.id = us.store_id where us.user_id = $1 and us.active order by s.id limit 1`, [userId]);
    if (r?.business_id) return +r.business_id;
    const [b] = await this.manager.query(`select id from business where active order by id limit 1`);
    return +(b?.id || 0);
  }

  async get(id: number, user: any) {
    const c = await this.ctx(user);
    const p = await this.visible(id, c);
    const names = await this.manager.query(`select id, full_name from app_user where id = any($1::int[])`, [[p.prepared_by, p.approved_by, p.confirmed_by, p.witness_id].filter(Boolean)]);
    const nameOf = (uid: number | null) => (uid ? names.find((n: any) => n.id === uid)?.full_name || null : null);
    const [store] = await this.manager.query(`select location from stores where id = $1`, [p.store_id]);
    const [aud] = p.audit_id ? await this.manager.query(`select audit_no from stock_audit where id = $1`, [p.audit_id]) : [null];
    const lines = await this.manager.query(
      `select l.id, l.item_id, l.product_id, l.title, l.batch, to_char(l.exp_date, 'YYYY-MM-DD') as exp_date, l.schedule, l.qty, l.cost_value::float as cost_value, l.tax_value::float as tax_value, l.mrp_value::float as mrp_value,
              l.qtychange_id, r.schedule as reg_schedule, r.serial_no as reg_serial
         from disposal_pass_line l left join schedule_disposal_register r on r.pass_line_id = l.id where l.pass_id = $1 order by l.id`, [id]);
    const sum = (k: string) => Math.round(lines.reduce((t: number, l: any) => t + Number(l[k] || 0), 0) * 100) / 100;
    const canManage = c.isManager && (c.isOwner || c.stores.includes(+p.store_id));
    return {
      ...p, store: store?.location || null, audit_no: aud ? `SA-${String(aud.audit_no).padStart(4, '0')}` : null, prepared_by_name: nameOf(p.prepared_by), approved_by_name: nameOf(p.approved_by), confirmed_by_name: nameOf(p.confirmed_by), witness_name: nameOf(p.witness_id),
      reason_label: REASON_LABEL[p.reason], method_label: METHOD_LABEL[p.method], lines,
      totals: { qty: lines.reduce((t: number, l: any) => t + l.qty, 0), cost: sum('cost_value'), tax: sum('tax_value'), mrp: sum('mrp_value') },
      witness_needed: needsWitness(lines, c.isManager),
      can: {
        approve: p.status === 'DRAFT' && canManage,
        reject: p.status === 'DRAFT' && canManage,
        cancel: ['DRAFT', 'APPROVED'].includes(p.status) && (c.isManager || p.prepared_by === c.id),
        confirm: p.status === 'APPROVED',
        edit: p.status === 'DRAFT' && (c.isManager || p.prepared_by === c.id),
      },
    };
  }

  /** the staff of a store, for naming a witness */
  async witnesses(q: any, user: any) {
    const c = await this.ctx(user);
    const store = Number(q?.storeid);
    if (!(store > 0)) return [];
    this.assertStore(c, store);
    return this.manager.query(
      `select u.id, u.full_name as name from user_stores us inner join app_user u on u.id = us.user_id where us.store_id = $1 and us.active and not us.archive and u.active and u.id <> $2 order by u.full_name`, [store, c.id]);
  }

  async pdf(id: number, user: any): Promise<{ name: string; buffer: Buffer }> {
    const pass: any = await this.get(id, user);
    const [biz] = await this.manager.query(`select b.name, b.address from business b where b.id = $1`, [pass.business_id]).catch(() => [null]);
    const buffer = await buildDisposalPdf(pass, { business: biz?.name || 'Business', address: biz?.address || undefined });
    return { name: `${pass.pass_no}.pdf`, buffer };
  }
}

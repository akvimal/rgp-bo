import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { DISMISS_REASONS, FIX_REASONS, BatchFacts, checkPack, checkReason, packCandidates, packImpact } from './pack-check-rules';

/**
 * Settling a product on the Pack check list: what to look at (recent purchases, stock, sales), what a new pack would do to stock,
 * and the two ways to close it, "the pack is correct" (with the reason) or "change the pack". Both are recorded with who and why.
 */
@Injectable()
export class PackCheckService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async product(id: number) {
    const [p] = await this.manager.query(`select id, title, pack from product where id = $1 and active`, [id]);
    if (!p) throw new NotFoundException('Product not found.');
    return p;
  }

  /** the batches of a product with what is needed to restate their units under another pack */
  private async batchFacts(productId: number): Promise<BatchFacts[]> {
    const rows = await this.manager.query(
      `select id, purchase_qty::int as purchase_qty, (sale_qty - available_qty)::float as used, coalesce(ptr_value, 0)::float as ptr from stock_view where product_id = $1`, [productId]);
    return rows.map((r: any) => ({ id: Number(r.id), purchaseQty: Number(r.purchase_qty), soldAndAdjusted: Number(r.used), ptr: Number(r.ptr) }));
  }

  /** what a person needs to settle one product */
  async evidence(productId: number) {
    const p = await this.product(productId);
    const purchases = await this.manager.query(
      `select pii.id, pi.id as invoice_id, pi.invoice_no, to_char(pi.invoice_date, 'YYYY-MM-DD') as invoice_date, v.business_name as vendor, pii.batch,
              pii.qty, coalesce(pii.free_qty, 0) as free_qty, pii.mrp_cost::float as mrp, pii.ptr_value::float as rate, coalesce(pii.tax_pcnt, 0)::float as tax
         from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id left join vendor v on v.id = pi.vendor_id
        where pii.product_id = $1 and pii.active and not pii.archive and pi.active and not pi.archive
        order by pi.invoice_date desc, pii.id desc limit 8`, [productId]);
    const batches = await this.batchFacts(productId);
    const now = packImpact(batches, Number(p.pack), Number(p.pack));
    const [sold] = await this.manager.query(
      `select coalesce(sum(si.qty), 0)::int as units from sale_item si join sale s on s.id = si.sale_id
        where si.product_id = $1 and s.status = 'COMPLETE' and si.active and not si.archive and s.bill_date >= now() - interval '90 days'`, [productId]);
    const history = await this.manager.query(
      `select r.action, r.reason, r.note, r.old_pack, r.new_pack, to_char(r.created_on, 'YYYY-MM-DD') as on, u.full_name as by
         from pack_check_resolution r left join app_user u on u.id = r.created_by where r.product_id = $1 order by r.id desc limit 5`, [productId]);
    const cands = packCandidates(Number(p.pack), purchases.map((x: any) => x.mrp));
    return {
      product: { id: Number(p.id), title: p.title, pack: Number(p.pack) },
      purchases, stockUnits: now.unitsBefore, stockValue: now.valueBefore, batches: batches.length, soldLast90Days: sold?.units ?? 0,
      candidates: cands, history,
      dismissReasons: DISMISS_REASONS, fixReasons: FIX_REASONS,
    };
  }

  /** what changing the pack to `pack` would do to stock */
  async impact(productId: number, packInput: unknown) {
    const p = await this.product(productId);
    const pack = checkPack(packInput);
    if (!pack) throw new BadRequestException('The pack has to be a whole number of 1 or more.');
    return packImpact(await this.batchFacts(productId), Number(p.pack), pack);
  }

  /** "the pack is correct": the product leaves the open list until a later purchase or price shows a new problem */
  async dismiss(productId: number, body: any, user: any) {
    const c = checkReason(body, DISMISS_REASONS);
    if (!c.ok) throw new BadRequestException(c.message);
    const p = await this.product(productId);
    await this.manager.query(
      `insert into pack_check_resolution (product_id, action, reason, note, old_pack, new_pack, created_by) values ($1, 'DISMISSED', $2, $3, $4, $4, $5)`,
      [productId, c.value.reason, c.value.note, p.pack, user.id]);
    await this.audit.record({ userId: user.id, action: 'pack_check.dismiss', entityType: 'product', entityId: productId,
      summary: `Pack of ${p.title} left at ${p.pack}: ${DISMISS_REASONS[c.value.reason]}`, details: { pack: p.pack, reason: c.value.reason, note: c.value.note } });
    return { ok: true };
  }

  /**
   * Changes the pack. It restates the units of every batch of the product, so it needs a reason and an explicit confirmation, it is
   * refused when a batch has already sold more units than the new pack would give it, and the pack the screen saw has to still be the
   * pack on the product (someone else may have changed it).
   */
  async fix(productId: number, body: any, user: any) {
    const pack = checkPack(body?.pack);
    if (!pack) throw new BadRequestException('The pack has to be a whole number of 1 or more.');
    if (body?.confirm !== true) throw new BadRequestException('Confirm the change first.');
    const c = checkReason(body, FIX_REASONS);
    if (!c.ok) throw new BadRequestException(c.message);
    const p = await this.product(productId);
    if (Number(body?.expectedPack) !== Number(p.pack)) throw new BadRequestException('The pack of this product has changed since you opened it. Reload and look again.');
    if (pack === Number(p.pack)) throw new BadRequestException('That is already the pack.');
    const imp = packImpact(await this.batchFacts(productId), Number(p.pack), pack);
    if (imp.belowZero > 0) {
      throw new BadRequestException(`${imp.belowZero} batch${imp.belowZero === 1 ? '' : 'es'} of this product have already sold more units than a pack of ${pack} would give. Correct the purchase lines instead, or count the stock first.`);
    }
    await this.manager.transaction(async (m) => {
      await m.query(`update product set pack = $1, updated_on = now(), updated_by = $2 where id = $3`, [pack, user.id, productId]);
      await m.query(
        `insert into pack_check_resolution (product_id, action, reason, note, old_pack, new_pack, created_by) values ($1, 'FIXED', $2, $3, $4, $5, $6)`,
        [productId, c.value.reason, c.value.note, p.pack, pack, user.id]);
    });
    await this.audit.record({ userId: user.id, action: 'pack_check.fix', entityType: 'product', entityId: productId,
      summary: `Pack of ${p.title} changed from ${p.pack} to ${pack}: ${FIX_REASONS[c.value.reason]}`,
      details: { oldPack: p.pack, newPack: pack, reason: c.value.reason, note: c.value.note, unitsBefore: imp.unitsBefore, unitsAfter: imp.unitsAfter, valueBefore: imp.valueBefore, valueAfter: imp.valueAfter } });
    return { ok: true, impact: imp };
  }
}

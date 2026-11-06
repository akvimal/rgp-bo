import { messageOf } from 'src/core/db-error';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { PurchaseInvoiceService } from '../purchase-invoice.service';
import { gstRates } from './invoice-extract.service';
import { cleanScanLine, countsOf, itemFromLine, lineAmount, missingFor, ScanLine } from './scan-rules';

/**
 * The lines read from a scanned invoice copy, kept with the draft so the invoice can be saved at once and checked a little at a time.
 * Checking a line against the copy (already corrected for the goods that came) makes it a VERIFIED invoice item right away; a line that is
 * not on the invoice is discarded with a reason. The invoice cannot be completed while a line is still open.
 */
@Injectable()
export class InvoiceScanService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly invoices: PurchaseInvoiceService, private readonly audit: AuditService) {}

  private async draft(invoiceId: number) {
    const [inv] = await this.manager.query(`select id, status, scan_meta from purchase_invoice where id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('That invoice does not exist.');
    if (inv.status !== 'NEW') throw new BadRequestException('Only a draft invoice has lines to check.');
    return inv;
  }

  private shape(r: any, rates: number[]) {
    const line: ScanLine = { productid: r.product_id, batch: r.batch ?? '', exp: r.exp_ym ?? '', mrp: r.mrp, qty: r.qty, free: r.free_qty, rate: r.rate, disc: r.disc_pcnt, tax: r.tax_pcnt, hsn: r.hsn };
    const missing = r.state === 'OPEN' ? missingFor(line, rates, !!r.noexpiry) : [];
    return {
      id: Number(r.id), position: r.position, description: r.description, productid: r.product_id, producttitle: r.product_title ?? '', noexpiry: !!r.noexpiry,
      suggestions: r.suggestions ?? [], batch: line.batch, exp: line.exp, mrp: line.mrp, qty: line.qty, free: line.free, rate: line.rate, disc: line.disc, tax: line.tax, hsn: r.hsn,
      warnings: r.warnings ?? [], state: r.state, itemid: r.item_id, verifiedby: r.verified_by, verifiedbyname: r.verified_by_name ?? null, verifiedon: r.verified_on,
      discardreason: r.discard_reason, missing, complete: r.state === 'OPEN' && missing.length === 0,
      amount: line.qty !== null && line.rate !== null ? lineAmount(Number(line.qty), Number(line.rate), Number(line.disc) || 0) : null,
    };
  }

  private readonly SELECT = `
    select l.id, l.position, l.description, l.product_id, p.title as product_title, (coalesce(p.more_props->>'noexpiry', '') = 'true') as noexpiry, l.suggestions, l.batch, l.exp_ym,
           l.mrp::float8 as mrp, l.qty::float8 as qty, l.free_qty::float8 as free_qty, l.rate::float8 as rate, l.disc_pcnt::float8 as disc_pcnt, l.tax_pcnt::float8 as tax_pcnt,
           l.hsn, l.warnings, l.state, l.item_id, l.verified_by, u.full_name as verified_by_name, l.verified_on, l.discard_reason
      from purchase_invoice_scan_line l left join product p on p.id = l.product_id left join app_user u on u.id = l.verified_by`;

  /** the lines of an invoice, how far the checking has got, and the numbers the form needs to check the lines against the invoice */
  async get(invoiceId: number) {
    const [inv] = await this.manager.query(`select id, status, scan_meta from purchase_invoice where id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('That invoice does not exist.');
    const rates = gstRates();
    const rows = await this.manager.query(`${this.SELECT} where l.invoice_id = $1 order by l.position, l.id`, [invoiceId]);
    const lines = rows.map((r: any) => this.shape(r, rates));
    return { status: inv.status, meta: inv.scan_meta ?? null, gstRates: rates, lines, counts: countsOf(lines) };
  }

  /** the open lines of the reading are saved with the draft (a reading made again replaces only what is still open) */
  async replace(invoiceId: number, body: any, userId: number) {
    await this.draft(invoiceId);
    const input: any[] = Array.isArray(body?.lines) ? body.lines.slice(0, 500) : [];
    const ids = Array.from(new Set(input.map((l) => (l?.productid ? Number(l.productid) : 0)).filter((n) => n > 0)));
    const known = ids.length ? new Set<number>((await this.manager.query(`select id from product where id = any($1::int[])`, [ids])).map((p: any) => p.id)) : new Set<number>();
    const [{ next }] = await this.manager.query(`select coalesce(max(position), 0) + 1 as next from purchase_invoice_scan_line where invoice_id = $1`, [invoiceId]);
    await this.manager.query(`delete from purchase_invoice_scan_line where invoice_id = $1 and state = 'OPEN'`, [invoiceId]);
    let pos = Number(next);
    for (const l of input) {
      let c: any;
      try { c = cleanScanLine({ free: 0, disc: 0, ...l }); } catch (e: any) { c = cleanScanLine({ description: l?.description }); }       // a reading's odd value is left for the person to set
      const product = c.productid && known.has(c.productid) ? c.productid : null;
      const sugg = (Array.isArray(l?.suggestions) ? l.suggestions : []).slice(0, 10).map((s: any) => ({ id: Number(s.id), title: String(s.title ?? '').slice(0, 200), score: Number(s.score) || 0, tax_pcnt: s.tax_pcnt ?? null, noexpiry: !!s.noexpiry }));
      const warnings = (Array.isArray(l?.warnings) ? l.warnings : []).slice(0, 10).map((w: any) => String(w).slice(0, 200));
      await this.manager.query(
        `insert into purchase_invoice_scan_line (invoice_id, position, description, product_id, suggestions, batch, exp_ym, mrp, qty, free_qty, rate, disc_pcnt, tax_pcnt, hsn, warnings, updated_by)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)`,
        [invoiceId, pos++, c.description ?? null, product, JSON.stringify(sugg), c.batch || null, c.exp || null, c.mrp ?? null, c.qty ?? null, c.free ?? 0, c.rate ?? null, c.disc ?? 0, c.tax ?? null, c.hsn ?? null, JSON.stringify(warnings), userId]);
    }
    const meta = body?.meta && typeof body.meta === 'object'
      ? { method: String(body.meta.method ?? '').slice(0, 20), cashFactor: Number(body.meta.cashFactor) > 0 && Number(body.meta.cashFactor) <= 1 ? Number(body.meta.cashFactor) : 1 } : null;
    await this.manager.query(`update purchase_invoice set scan_meta = $2::jsonb where id = $1`, [invoiceId, meta ? JSON.stringify(meta) : null]);
    return this.get(invoiceId);
  }

  private async load(invoiceId: number, lineId: number) {
    const [r] = await this.manager.query(`${this.SELECT} where l.invoice_id = $1 and l.id = $2`, [invoiceId, lineId]);
    if (!r) throw new NotFoundException('That line is not here any more.');
    return r;
  }

  /** a correction to a line that is still open (saved as it is typed) */
  async saveLine(invoiceId: number, lineId: number, body: any, userId: number) {
    await this.draft(invoiceId);
    const r = await this.load(invoiceId, lineId);
    if (r.state !== 'OPEN') throw new BadRequestException(r.state === 'VERIFIED' ? 'This line is checked. Uncheck it to change it.' : 'This line is discarded. Restore it to change it.');
    let c: any;
    try { c = cleanScanLine(body ?? {}); } catch (e: any) { throw new BadRequestException(e.message); }
    if (c.productid) {
      const [p] = await this.manager.query(`select id from product where id = $1`, [c.productid]);
      if (!p) throw new BadRequestException('That product was not found.');
    }
    const map: Record<string, string> = { productid: 'product_id', batch: 'batch', exp: 'exp_ym', mrp: 'mrp', qty: 'qty', free: 'free_qty', rate: 'rate', disc: 'disc_pcnt', tax: 'tax_pcnt', hsn: 'hsn', description: 'description' };
    const sets: string[] = [], args: any[] = [lineId];
    for (const [k, col] of Object.entries(map)) {
      if (k in c) { args.push(k === 'exp' || k === 'batch' ? (c[k] || null) : c[k]); sets.push(`${col} = $${args.length}`); }
    }
    if (sets.length) {
      args.push(userId); sets.push(`updated_by = $${args.length}`, `updated_on = now()`);
      await this.manager.query(`update purchase_invoice_scan_line set ${sets.join(', ')} where id = $1`, args);
    }
    return this.shape(await this.load(invoiceId, lineId), gstRates());
  }

  /** the line agrees with the invoice copy: it becomes a VERIFIED item of the invoice now */
  async verify(invoiceId: number, lineId: number, userId: number) {
    await this.draft(invoiceId);
    const r = await this.load(invoiceId, lineId);
    if (r.state !== 'OPEN') throw new BadRequestException(r.state === 'VERIFIED' ? 'This line is already checked.' : 'This line is discarded.');
    const rates = gstRates();
    const shaped = this.shape(r, rates);
    if (shaped.missing.length) throw new BadRequestException(`This line cannot be checked yet. It needs: ${shaped.missing.join(', ')}.`);
    // claim the line first, so two people ticking it at once make one item
    const claimed = await this.manager.query(`update purchase_invoice_scan_line set state = 'VERIFIED', verified_by = $2, verified_on = now(), updated_by = $2, updated_on = now() where id = $1 and state = 'OPEN' returning id`, [lineId, userId]);
    if (!claimed.length) throw new BadRequestException('Someone has just changed this line. Reload and look again.');
    try {
      const line: ScanLine = { productid: r.product_id, batch: r.batch, exp: r.exp_ym ?? '', mrp: r.mrp, qty: r.qty, free: r.free_qty, rate: r.rate, disc: r.disc_pcnt, tax: r.tax_pcnt, hsn: r.hsn };
      const item = await this.invoices.createItem(itemFromLine(invoiceId, line, userId) as any, userId);
      await this.invoices.refreshTotal(invoiceId, userId);
      await this.manager.query(`update purchase_invoice_scan_line set item_id = $2 where id = $1`, [lineId, (item as any).id]);
    } catch (e) {
      await this.manager.query(`update purchase_invoice_scan_line set state = 'OPEN', verified_by = null, verified_on = null where id = $1`, [lineId]);
      throw e;
    }
    return this.shape(await this.load(invoiceId, lineId), rates);
  }

  /** every open line that is complete is checked at once (for a clean copy); the others are left and counted */
  async verifyAll(invoiceId: number, userId: number) {
    await this.draft(invoiceId);
    const rates = gstRates();
    const rows = await this.manager.query(`${this.SELECT} where l.invoice_id = $1 and l.state = 'OPEN' order by l.position, l.id`, [invoiceId]);
    let verified = 0, skipped = 0;
    const failed: { id: number; message: string }[] = [];
    for (const r of rows) {
      if (this.shape(r, rates).missing.length) { skipped++; continue; }
      try { await this.verify(invoiceId, Number(r.id), userId); verified++; } catch (e: any) { failed.push({ id: Number(r.id), message: messageOf(e, 'Could not check it.') }); }
    }
    await this.audit.record({ userId, action: 'purchase.scan_verified_all', entityType: 'purchase_invoice', entityId: invoiceId, summary: `${verified} scanned lines checked together on invoice ${invoiceId}`, details: { verified, skipped, failed: failed.length } });
    return { verified, skipped, failed, ...(await this.get(invoiceId)) };
  }

  /** a checked line is put back to open to correct it: its item is removed (only while the item is as it was made) */
  async unverify(invoiceId: number, lineId: number, userId: number) {
    await this.draft(invoiceId);
    const r = await this.load(invoiceId, lineId);
    if (r.state !== 'VERIFIED' || !r.item_id) throw new BadRequestException('This line is not checked.');
    const [item] = await this.manager.query(`select id, status from purchase_invoice_item where id = $1`, [r.item_id]);
    if (item && item.status !== 'VERIFIED') throw new BadRequestException(`The item was changed on the items page (${String(item.status).toLowerCase()}). Change it there.`);
    if (item) { await this.invoices.removeItems([item.id]); await this.invoices.refreshTotal(invoiceId, userId); }
    await this.manager.query(`update purchase_invoice_scan_line set state = 'OPEN', item_id = null, verified_by = null, verified_on = null, updated_by = $2, updated_on = now() where id = $1`, [lineId, userId]);
    return this.shape(await this.load(invoiceId, lineId), gstRates());
  }

  /** a line that is not on the invoice (a misread, a repeated row) is put aside with a reason */
  async discard(invoiceId: number, lineId: number, reason: any, userId: number) {
    await this.draft(invoiceId);
    const r = await this.load(invoiceId, lineId);
    if (r.state !== 'OPEN') throw new BadRequestException('Only a line still to check can be discarded.');
    const why = String(reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (why.length < 3) throw new BadRequestException('Say why the line is not on the invoice.');
    await this.manager.query(`update purchase_invoice_scan_line set state = 'DISCARDED', discard_reason = $2, updated_by = $3, updated_on = now() where id = $1`, [lineId, why, userId]);
    await this.audit.record({ userId, action: 'purchase.scan_line_discarded', entityType: 'purchase_invoice', entityId: invoiceId, summary: `scanned line "${String(r.description ?? '').slice(0, 60)}" discarded: ${why}`, details: { lineId } });
    return this.shape(await this.load(invoiceId, lineId), gstRates());
  }

  async restore(invoiceId: number, lineId: number, userId: number) {
    await this.draft(invoiceId);
    const r = await this.load(invoiceId, lineId);
    if (r.state !== 'DISCARDED') throw new BadRequestException('This line is not discarded.');
    await this.manager.query(`update purchase_invoice_scan_line set state = 'OPEN', discard_reason = null, updated_by = $2, updated_on = now() where id = $1`, [lineId, userId]);
    return this.shape(await this.load(invoiceId, lineId), gstRates());
  }
}

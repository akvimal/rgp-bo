import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { buildPriceList, PriceListEntry } from './price-list';
import { PRICE_LIST_SQL } from './price-list.sql';
import { buildPriceListPdf, stamp } from './price-list-pdf';
import { ModulesService } from 'src/core/modules/modules.service';
import { buildProcedurePdf } from './procedure-pdf';
import { TodoService } from '../todos/todo.service';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

/**
 * The printed documents a shop keeps for the counter: the price list (in stock, with GST, per pack and per unit) and the outage procedure. They were
 * the outage kit's; they stand alone now, are printed from Products or from the Outage readiness checklist, and a print closes the system's
 * "print a fresh price list" to-do.
 */
@Injectable()
export class OutageService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly modules: ModulesService, private readonly todos: TodoService) {}

  // ------------------------------------------------------------------ the printed documents
  private async header(businessId: number) {
    const [b] = await this.manager.query(`select name, address, gstin from business where id = $1`, [businessId]);
    const pharmacy = await this.modules.packOnForBusiness(businessId, 'pharmacy');
    return { pharmacy, business: String(b?.name ?? 'Pharmacy').trim(), address: b?.address ? String(b.address).trim() : undefined, gstin: b?.gstin ? String(b.gstin).trim() : undefined };
  }

  /** the price list as a PDF or an Excel file; the print is recorded so the page can say when the counter copy was last renewed */
  async priceList(userid: number, format: 'pdf' | 'xlsx') {
    const businessId = await businessOfUser(this.manager, userid);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const entries = buildPriceList(await this.manager.query(PRICE_LIST_SQL));
    const generatedAt = new Date();
    const head = await this.header(businessId);
    const buffer = format === 'xlsx' ? await this.priceListXlsx(entries, head.business, generatedAt, head.pharmacy) : await buildPriceListPdf(entries, { ...head, generatedAt });
    await this.audit.record({ userId: userid, action: 'outage.price_list_printed', entityType: 'outage',
      summary: `Price list ${format === 'xlsx' ? 'downloaded' : 'printed'} (${entries.length} products)`, details: { format, count: entries.length } });
    // the price list is the same for every store of the business: the weekly "print a price list" to-do is done for all of them
    await this.todos.completeSystemTask(businessId, null, 'price_list', userid, `Price list ${format === 'xlsx' ? 'downloaded' : 'printed'}`);
    return {
      buffer, count: entries.length,
      filename: `price-list-${istDay(generatedAt)}.${format}`,
      contentType: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
    };
  }

  private async priceListXlsx(entries: PriceListEntry[], business: string, generatedAt: Date, pharmacy = true): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = business;
    const ws = wb.addWorksheet('Price list', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Product', key: 'title', width: 52 }, { header: 'Pack', key: 'pack', width: 8 },
      { header: 'Price per pack (with GST)', key: 'packIncl', width: 24 }, { header: 'Price per unit (with GST)', key: 'unitIncl', width: 24 },
      { header: 'MRP per pack', key: 'mrp', width: 14 }, ...(pharmacy ? [{ header: 'Prescription only', key: 'rx', width: 16 }] : []),
    ];
    ws.getRow(1).font = { bold: true };
    entries.forEach((e) => ws.addRow({ title: e.title, pack: e.pack, packIncl: e.packIncl, unitIncl: e.unitIncl, mrp: e.mrp, rx: e.rx ? 'Rx' : '' }));
    ['C', 'D', 'E'].forEach((c) => { ws.getColumn(c).numFmt = '0.00'; });
    ws.autoFilter = { from: 'A1', to: 'F1' };
    const about = wb.addWorksheet('About');
    about.addRows([[`${business}: price list for the counter`], [`Valid as of ${stamp(generatedAt)}`], [`Prices include GST. Per unit is one ${pharmacy ? 'tablet, capsule or piece' : 'piece'}.`],
      ['Only products in stock when this was made are listed. A new list replaces this one.']]);
    about.getColumn(1).width = 90;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async procedure(userid: number) {
    const businessId = await businessOfUser(this.manager, userid);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const head = await this.header(businessId);
    return { buffer: await buildProcedurePdf(head.business, new Date(), head.pharmacy), filename: 'outage-procedure.pdf', contentType: 'application/pdf' };
  }
}

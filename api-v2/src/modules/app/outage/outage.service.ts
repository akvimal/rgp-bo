import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
import { daysSince, isReady, KIT_CHECKLIST, OUTAGE_CAUSES, procedureFor, READY_WITHIN_DAYS, recordItems } from './outage-kit';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const text = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

/**
 * The outage kit: the weekly record that the shop is ready to sell by hand if the power or the connection goes (price list printed, bill book,
 * UPS, light), the printed price list and procedure, and a log of each outage with the manual bill numbers used.
 */
@Injectable()
export class OutageService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly modules: ModulesService) {}

  /** the business of the user, and the store the page is about: the one asked for (it must be the business's own) or the business's first */
  private async scope(userid: number, storeid?: number | null) {
    const businessId = await businessOfUser(this.manager, userid);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const stores = await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive order by id`, [businessId]);
    const store = storeid ? stores.find((s: any) => +s.id === +storeid) : stores[0];
    if (storeid && !store) throw new BadRequestException('That store does not belong to your business.');
    return { businessId, store: store ? { id: +store.id, location: String(store.location).trim() } : null };
  }

  async status(userid: number, storeid?: number | null) {
    const { businessId, store } = await this.scope(userid, storeid);
    const sid = store?.id ?? null;
    const last = async (completeOnly: boolean) => (await this.manager.query(
      `select l.id, to_char(l.checked_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day, l.checked_on, l.complete, l.bill_book_last, l.note, l.items, u.full_name as by_name
         from outage_readiness_log l join app_user u on u.id = l.checked_by
        where l.business_id = $1 and l.store_id is not distinct from $2 ${completeOnly ? 'and l.complete' : ''} order by l.id desc limit 1`, [businessId, sid]))[0] ?? null;
    const [lastAny, lastComplete] = await Promise.all([last(false), last(true)]);
    const [lastPrint] = await this.manager.query(
      `select a.occurred_on, u.full_name as by_name, a.details
         from audit_event a join app_user u on u.id = a.user_id
        where a.action = 'outage.price_list_printed'
          and (select coalesce(x.business_id, (select s.business_id from user_stores us join stores s on s.id = us.store_id where us.user_id = x.id and us.active and not us.archive order by us.is_primary desc, us.id limit 1)) from app_user x where x.id = a.user_id) = $1
        order by a.id desc limit 1`, [businessId]);
    const events = await this.manager.query(
      `select e.id, e.started_on, e.ended_on, e.cause, e.manual_from, e.manual_to, e.manual_count, e.note, u.full_name as by_name
         from outage_event e join app_user u on u.id = e.entered_by
        where e.business_id = $1 and e.store_id is not distinct from $2 order by e.started_on desc limit 15`, [businessId, sid]);
    const today = istDay();
    const lastCompleteDay = lastComplete?.day ?? null;
    return {
      store, stores: (await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive order by id`, [businessId])).map((s: any) => ({ id: +s.id, location: String(s.location).trim() })),
      checklist: KIT_CHECKLIST, procedure: procedureFor(await this.modules.packOnForBusiness(businessId, 'pharmacy')), within: READY_WITHIN_DAYS, today,
      last: lastAny, lastcomplete: lastComplete, ready: isReady(lastCompleteDay, today), dayssince: daysSince(lastCompleteDay, today),
      lastprint: lastPrint ? { on: lastPrint.occurred_on, by: lastPrint.by_name, count: lastPrint.details?.count ?? null, format: lastPrint.details?.format ?? null } : null,
      events,
    };
  }

  async saveReadiness(userid: number, body: any) {
    const { businessId, store } = await this.scope(userid, body?.storeid ? +body.storeid : null);
    const { items, complete } = recordItems(body?.items);
    const [row] = await this.manager.query(
      `insert into outage_readiness_log (business_id, store_id, checked_by, items, complete, bill_book_last, note)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7) returning id`,
      [businessId, store?.id ?? null, userid, JSON.stringify(items), complete, text(body?.billbooklast, 40), text(body?.note, 300)]);
    await this.audit.record({ userId: userid, action: 'outage.readiness', entityType: 'outage', entityId: row.id,
      summary: `Outage kit checked${store ? ` at ${store.location}` : ''}: ${complete ? 'complete' : `${items.filter((i) => !i.ticked).length} item(s) not ready`}`, details: { complete } });
    return { id: row.id, complete };
  }

  // ------------------------------------------------------------------ outages
  private whenOf(v: any, label: string): Date | null {
    if (v === undefined || v === null || v === '') return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException(`${label} is not a valid date and time.`);
    if (d.getTime() > Date.now() + 24 * 3600000) throw new BadRequestException(`${label} cannot be in the future.`);
    return d;
  }

  private eventFields(body: any) {
    const cause = String(body?.cause ?? '').toUpperCase();
    if (!(OUTAGE_CAUSES as readonly string[]).includes(cause)) throw new BadRequestException('Choose the cause: power, internet, server or other.');
    const started = this.whenOf(body?.startedon, 'The start');
    if (!started) throw new BadRequestException('Give when it started.');
    const ended = this.whenOf(body?.endedon, 'The end');
    if (ended && ended < started) throw new BadRequestException('It cannot end before it started.');
    const count = body?.manualcount === undefined || body?.manualcount === null || body?.manualcount === '' ? null : Number(body.manualcount);
    if (count !== null && !(Number.isInteger(count) && count >= 0 && count <= 5000)) throw new BadRequestException('The number of manual bills must be a whole number.');
    return { cause, started, ended, count, from: text(body?.manualfrom, 40), to: text(body?.manualto, 40), note: text(body?.note, 300) };
  }

  async addEvent(userid: number, body: any) {
    const { businessId, store } = await this.scope(userid, body?.storeid ? +body.storeid : null);
    const f = this.eventFields(body);
    const [row] = await this.manager.query(
      `insert into outage_event (business_id, store_id, started_on, ended_on, cause, manual_from, manual_to, manual_count, note, entered_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [businessId, store?.id ?? null, f.started, f.ended, f.cause, f.from, f.to, f.count, f.note, userid]);
    await this.audit.record({ userId: userid, action: 'outage.event', entityType: 'outage', entityId: row.id,
      summary: `Outage recorded (${f.cause.toLowerCase()})${f.count !== null ? `, ${f.count} manual bill(s)` : ''}`, details: { cause: f.cause, from: f.from, to: f.to, count: f.count } });
    return { id: row.id };
  }

  async updateEvent(userid: number, id: number, body: any) {
    const businessId = await businessOfUser(this.manager, userid);
    const [e] = await this.manager.query(`select id, business_id from outage_event where id = $1`, [id]);
    if (!e || +e.business_id !== +businessId!) throw new NotFoundException('That outage was not found.');
    const f = this.eventFields(body);
    await this.manager.query(
      `update outage_event set started_on = $2, ended_on = $3, cause = $4, manual_from = $5, manual_to = $6, manual_count = $7, note = $8 where id = $1`,
      [id, f.started, f.ended, f.cause, f.from, f.to, f.count, f.note]);
    await this.audit.record({ userId: userid, action: 'outage.event_updated', entityType: 'outage', entityId: id, summary: `Outage ${id} updated`, details: { cause: f.cause, count: f.count } });
    return { id };
  }

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

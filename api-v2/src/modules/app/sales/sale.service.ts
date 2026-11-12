import { userError } from 'src/core/db-error';
import { SaleHooks } from "src/core/sale-hooks/sale-hooks";
import { ModulesService } from "src/core/modules/modules.service";
import { BadRequestException, ForbiddenException, HttpException, Injectable, ConflictException } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { recordStaffCredit } from "./staff-credit-rule";
import { recordCustomerDue } from "./customer-due-rule";
import { recordStoreCredit, settleReturn } from "./store-credit-rule";
import { EntityManager } from "typeorm";
import { loadStoreProfile } from "../store/store-profile";
import { returnRules } from "./return-rule";
import { BatchMrp, overMrp, overMrpMessage } from "./mrp-guard";
import { voidProblem, voidReasonProblem } from "./void-rule";
import { staleGst, staleGstMessage, CurrentGst } from "./gst-guard";
import { Repository } from "typeorm";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { CreateSaleReturnItemDto } from "./dto/create-salereturnitem.dto";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturnitem.dto";
import { SaleItem } from "src/entities/sale-item.entity";
import { SaleReturnItem } from "src/entities/salereturn-item.entity";
import { Sale } from "src/entities/sale.entity";
import { SaleDelivery } from "src/entities/sale-delivery.entity";
import { StoreCashAccount } from "src/entities/store-cash-account.entity";
import { assertIssuedBillUnchanged, assignGstInvoice, issueCreditNote } from "../gst/gst-invoice";

export interface SaleListQuery {
  date?: string;
  billno?: string;
  customer?: string;
  status?: string;
  actinguserid?: string;
  storeid?: string;
  page?: string;
  limit?: string;
}

export interface SaleItemsQuery {
  product?: string;
  category?: string;
  fromdate?: string;
  todate?: string;
  props?: Array<{ id: string; value: string }>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface SalePayload {
  billdate?: string;
  orderdate?: Date | string;
  orderno?: number;
  billno?: number;
  status?: string;
  ordertype?: string;
  deliverytype?: string;
  digimethod?: string | null;
  digirefno?: string | null;
  digiprovider?: string | null;
  staffcreditamt?: number;
  staffcredituserid?: number | null;
  staffcreditfor?: string | null;
  dueamt?: number;
  duedate?: string | null;
  creditamt?: number;
  digiamt?: number;
  cashamt?: number;
  expreturndays?: number;
  docpending?: boolean;
  customerid?: number;
  customer?: any;
  actinguserid?: number | null;
  shiftid?: number | null;
  storeid?: number | null;
  buyergstin?: string | null;
  placeofsupply?: string | null;
  items?: any[];
}

@Injectable()
export class SaleService {

    constructor(@InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem) private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(SaleReturnItem) private readonly saleReturnItemRepository: Repository<SaleReturnItem>,
    @InjectEntityManager() private manager: EntityManager,
    private readonly hooks: SaleHooks,
    private readonly modules: ModulesService) { }

    async create(sale: SalePayload, userid: number, actingUserid?: number) {
        // Wrap entire sale creation in transaction to prevent orphaned data
        return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                const items = Array.isArray(sale.items) ? sale.items : [];

                // WS-6: which store this sale belongs to. The caller (POS, via the header's store
                // selector) says which store it's at; fall back to the business's first store so
                // every existing single-store caller (including the qa seed) keeps working unchanged.
                let storeid: number | null = sale.storeid ? Number(sale.storeid) : null;
                if (storeid) {
                    const validRows = await transactionManager.query(`select id from stores where id = $1`, [storeid]);
                    if (!validRows?.length) {
                        storeid = null;
                    }
                }
                if (!storeid) {
                    const storeRows = await transactionManager.query(`select id from stores order by id asc limit 1`);
                    storeid = storeRows?.[0]?.id || null;
                }

                await this.guardCompleteBill(transactionManager, sale, items, storeid, 0);

                // Step 1: Generate order and bill numbers (uses database sequences/locking)
                const nos = await transactionManager.query(`select generate_order_number() as order_no, generate_bill_number() as bill_no`);

                sale['orderno'] = nos[0]['order_no'];
                sale['orderdate'] = new Date();
                sale['billno'] = nos[0]['bill_no'];

                const { shiftid, staffBased } = await this.openShiftFor(transactionManager, storeid, actingUserid, userid);
                // A completed bill is a cash event — it must belong to an open shift so
                // it is reconciled at close. Parked (PENDING) bills are exempt.
                if ((sale.status || '').toUpperCase() === 'COMPLETE' && storeid && !shiftid) {
                    throw new BadRequestException(staffBased ? 'Open your own shift before completing sales.' : 'Open a shift before completing sales.');
                }
                sale['shiftid'] = shiftid;
                sale['storeid'] = storeid;

                // the buyer's GSTIN and the place of supply (GST); the invoice number is never taken from the client
                await this.normaliseBuyer(transactionManager, sale);
                delete (sale as any).gstinvoiceno; delete (sale as any).gstbusinessid;

                // Step 2: Save sale header
                const savedSale = await transactionManager.save(Sale, {...sale, createdby:userid, actinguserid: actingUserid || userid});

                if (!savedSale || !savedSale.id) {
                    throw new Error('Failed to create sale header');
                }

                // Step 3: Save sale items with foreign key to sale
                if (sale.items && sale.items.length > 0) {
                    sale.items.forEach(i => {
                        i.saleid = savedSale.id;
                    });
                    await transactionManager.save(SaleItem, sale.items);
                }
                // a completed bill of a registered business is a tax invoice with the next number of its series
                const invoiceNo = await assignGstInvoice(transactionManager, savedSale.id);
                if (invoiceNo) { savedSale.gstinvoiceno = invoiceNo; }
                await recordStaffCredit(transactionManager, savedSale, actingUserid || userid);
                await recordStoreCredit(transactionManager, savedSale, actingUserid || userid);
                await recordCustomerDue(transactionManager, savedSale, actingUserid || userid);
                // a business pack may write its own records for this bill (they stand or fall with it)
                await this.hooks.saved({ manager: transactionManager, sale, saved: savedSale, items: sale.items || [], storeId: storeid, userId: userid, actingUserId: actingUserid });

                if (shiftid && Number(savedSale['cashamt'] || sale['cashamt'] || 0) > 0) {
                    await transactionManager.save(StoreCashAccount, {
                        transdate: new Date().toISOString().slice(0, 10),
                        category: 'SALE',
                        description: `Sale ${savedSale['billno'] || savedSale['id']}`,
                        deposit: Number(savedSale['cashamt'] || sale['cashamt'] || 0),
                        withdraw: 0,
                        store: { id: storeid },
                        shift: { id: shiftid },
                    } as any);
                }

                // The client only needs the saved header before loading the detail route.
                return savedSale;
            } catch (error) {
                // Transaction will automatically rollback on error.
                // Preserve validation errors (400s) instead of masking them as 500.
                if (error instanceof HttpException) { throw error; }
                throw userError(error, 'save the bill');
            }
        });
    }

    /** the buyer's GSTIN (checked) decides the place of supply; with none, a delivery state may be given; otherwise it is the seller's state when the invoice is numbered */
    private async normaliseBuyer(tm: EntityManager, sale: any) {
        if (sale.buyergstin === undefined && sale.placeofsupply === undefined) return;
        const g = String(sale.buyergstin ?? '').trim().toUpperCase();
        if (g) {
            const [ok] = await tm.query(`select public.is_valid_gstin($1) as ok`, [g]);
            if (!ok?.ok) throw new BadRequestException("The buyer's GSTIN is not valid. Check the 15 characters, the state code and the check digit.");
            sale.buyergstin = g;
            sale.placeofsupply = g.slice(0, 2);
            return;
        }
        sale.buyergstin = null;
        const p = String(sale.placeofsupply ?? '').trim();
        if (p && !/^(0[1-9]|[12][0-9]|3[0-8]|97|99)$/.test(p)) throw new BadRequestException('The place of supply must be a GST state code.');
        sale.placeofsupply = p || null;
    }

    /** a business or a store that takes no returns refuses them, whatever the screen allowed */
    private async assertReturnsOpen(saleItemIds: number[]) {
        const ids = saleItemIds.filter((n) => Number.isFinite(n));
        if (!ids.length) return;
        const rows = await this.manager.query(
            `select distinct s.store_id from sale_item si join sale s on s.id = si.sale_id where si.id = any($1::int[])`, [ids]);
        for (const r of rows) {
            const why = await this.modules.returnsBlocked(r.store_id);
            if (why) throw new ForbiddenException(why);
        }
    }

    /**
     * Create return items with transaction protection
     * Fixed: Batch insert now atomic, preventing orphaned return items
     */
    async createReturnItems(items: CreateSaleReturnItemDto[], userid: number) {
        await this.assertReturnsOpen(items.map((i) => Number(i.saleitemid)));
        return await this.saleReturnItemRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                // Never let the returned quantity for a sale line exceed what
                // was sold on it (net of returns already recorded).
                const wanted = new Map<number, number>();
                for (const item of items) {
                    const id = Number(item.saleitemid);
                    const qty = Number(item.qty);
                    if (!Number.isFinite(id) || !Number.isFinite(qty) || qty <= 0) {
                        throw new BadRequestException('Each return line needs a sale item and a positive quantity.');
                    }
                    wanted.set(id, (wanted.get(id) || 0) + qty);
                }
                for (const [saleItemId, qty] of wanted) {
                    const [row] = await transactionManager.query(
                        `select si.qty - coalesce(sum(sri.qty), 0) as eligible
                           from sale_item si
                           left join sale_return_item sri
                             on sri.sale_item_id = si.id and sri.active = true and sri.archive = false
                          where si.id = $1
                          group by si.qty`,
                        [saleItemId],
                    );
                    if (!row) {
                        throw new BadRequestException(`Sale item ${saleItemId} not found.`);
                    }
                    if (qty > Number(row.eligible)) {
                        throw new BadRequestException(
                            `Cannot return ${qty}; only ${Number(row.eligible)} of that item is eligible.`);
                    }
                }

                // a refrigerated or otherwise barred product is not taken back; some must be inspected first
                const rules = await returnRules(transactionManager, Array.from(wanted.keys()));
                for (const [saleItemId] of wanted) {
                    const r = rules.get(saleItemId);
                    if (r?.rule === 'NONE') throw new BadRequestException(`${r.title} cannot be returned: this store does not take it back.`);
                }
                items.forEach(item => {
                    item['createdby'] = userid;
                    item['needsinspection'] = rules.get(Number(item.saleitemid))?.rule === 'INSPECT';
                });
                return await transactionManager.save(SaleReturnItem, items);
            } catch (error) {
                // Transaction will automatically rollback on error
                if (error instanceof HttpException) { throw error; }
                throw userError(error, 'record the return');
            }
        });
    }

    /**
     * Update return item with transaction protection
     * Fixed: Update now atomic, ensuring consistency
     */
    async updateReturnItem(item: UpdateSaleReturnItemDto, userid: number) {
        return await this.saleReturnItemRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                item['updatedby'] = userid;
                // settling a return records how the customer is refunded, and issues store credit for a credit refund
                if (String(item['status'] || '').toUpperCase() === 'ADJUSTED' && item['id']) {
                    await settleReturn(transactionManager, item, userid);
                }
                const saved = await transactionManager.save(SaleReturnItem, item);
                // a settled return of a tax invoice gets a credit note at the invoice's own rate
                if (String(item['status'] || '').toUpperCase() === 'ADJUSTED' && item['id']) {
                    await issueCreditNote(transactionManager, Number(item['id']), userid);
                }
                return saved;
            } catch (error) {
                // Transaction will automatically rollback on error
                if (error instanceof HttpException) { throw error; }
                throw userError(error, 'update the return');
            }
        });
    }


    /**
     * What a completed bill must satisfy, whether it is made now or a parked bill is completed later: payment equal to the total for a counter sale, no price above
     * the MRP, and no more stock than the store has. `ownSaleId` is the bill being edited, so its own earlier lines are not counted as sold.
     */
    private async guardCompleteBill(transactionManager: EntityManager, sale: any, items: any[], storeid: number | null, ownSaleId: number) {
        // A completed bill must not oversell stock at this store, and a counter sale must
        // be fully tendered (delivery sales collect payment via the delivery flow).
        if ((sale.status || '').toUpperCase() === 'COMPLETE') {
            const isCounter = String(sale['deliverytype'] || 'Counter').toLowerCase() !== 'delivery';
            const tendered = Number(sale['cashamt'] || 0) + Number(sale['digiamt'] || 0) + Number(sale['staffcreditamt'] || 0) + Number(sale['creditamt'] || 0) + Number(sale['dueamt'] || 0);
            const total = Number(sale['total'] || 0);
            if (isCounter && Math.abs(tendered - total) > 0.5) {
                throw new BadRequestException(`Payment (${tendered.toFixed(2)}) does not match the bill total (${total.toFixed(2)}).`);
            }

            // never charge more than the MRP: price + GST per unit against the batch's MRP per unit (kill switch: pricing/sale_mrp_guard = off)
            const pricedLines = items.filter((i: any) => Number(i.qty || 0) > 0 && Number(i.price || 0) > 0 && i.itemid);
            if (pricedLines.length) {
                const [g] = await transactionManager.query(`select setting_value from app_setting where setting_key = 'sale_mrp_guard' and active and not archive limit 1`);
                if (String(g?.setting_value ?? 'on').toLowerCase() !== 'off') {
                    const mrpRows = await transactionManager.query(
                        `select pii.id, pii.mrp_cost::float8 / nullif(p.pack, 0) as unit_mrp, p.title from purchase_invoice_item pii join product p on p.id = pii.product_id where pii.id = any($1::int[])`,
                        [pricedLines.map((i: any) => Number(i.itemid))]);
                    const batches = new Map<number, BatchMrp>(mrpRows.map((r: any) => [Number(r.id), { unitMrp: Number(r.unit_mrp), title: r.title }]));
                    const over = overMrp(pricedLines.map((i: any) => ({ itemid: Number(i.itemid), price: Number(i.price), taxpcnt: Number(i.taxpcnt || 0), qty: Number(i.qty) })), batches);
                    if (over.length) throw new BadRequestException(overMrpMessage(over));
                }
            }
            // the GST charged is the rate in force today for the product, not the rate of the batch it came from (kill switch: pricing/sale_gst_guard = off).
            // A bill that carries another rate is sent back with the right one on each line, so the till can correct it and the person can check the total.
            const gstLines = items.filter((i: any) => Number(i.qty || 0) > 0 && i.itemid);
            if (gstLines.length) {
                const [gg] = await transactionManager.query(`select setting_value from app_setting where setting_key = 'sale_gst_guard' and active and not archive limit 1`);
                if (String(gg?.setting_value ?? 'on').toLowerCase() !== 'off') {
                    const rateRows = await transactionManager.query(
                        `select pii.id, p.title, public.gst_sale_rate(p.id, pii.tax_pcnt::double precision, current_date) as rate
                           from purchase_invoice_item pii join product p on p.id = pii.product_id where pii.id = any($1::int[])`,
                        [gstLines.map((i: any) => Number(i.itemid))]);
                    const today = new Map<number, CurrentGst>(rateRows.map((r: any) => [Number(r.id), { title: r.title, rate: Number(r.rate) }]));
                    const stale = staleGst(gstLines.map((i: any) => ({ itemid: Number(i.itemid), taxpcnt: Number(i.taxpcnt || 0), qty: Number(i.qty) })), today);
                    if (stale.length) throw new ConflictException({ code: 'GST_RATE_CHANGED', message: staleGstMessage(stale), lines: stale });
                }
            }
            const positiveLines = items.filter((i: any) => Number(i.qty || 0) > 0 && i.itemid);
            if (positiveLines.length) {
                // available at this store = batch qty (only where it was received into this
                // store) - sale_item qty sold at this store + approved adjustments/transfer
                // postings at this store. Same shape as stock.service.findByCriteria's storeid path.
                const rows = await transactionManager.query(
                    `select pii.id as item_id,
                        (case when i.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
                        - coalesce((select sum(si.qty) from sale_item si
                                    inner join sale s on s.id = si.sale_id
                                    where si.purchase_item_id = pii.id and si.active = true and si.archive = false
                                      and s.store_id = $2 and s.id <> $3), 0)
                        + coalesce((select sum(pq.qty) from product_qtychange pq
                                    where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED'
                                      and pq.active = true and pq.archive = false
                                      and pq.store_id = $2), 0) - coalesce((select sum(l.qty) from disposal_pass_line l inner join disposal_pass dp on dp.id = l.pass_id where l.item_id = pii.id and dp.status = 'APPROVED' and dp.store_id = $2), 0)
                        as available
                     from purchase_invoice_item pii
                     inner join purchase_invoice i on i.id = pii.invoice_id
                     inner join product p on p.id = pii.product_id
                     where pii.id = any($1::int[])`,
                    [positiveLines.map((i: any) => Number(i.itemid)), storeid, ownSaleId],
                );
                const avail = new Map<number, number>(rows.map((r: any) => [Number(r.item_id), Number(r.available)]));
                // aggregate requested qty per batch (a bill can list the same batch twice)
                const requested = new Map<number, number>();
                for (const i of positiveLines) {
                    const k = Number(i.itemid);
                    requested.set(k, (requested.get(k) || 0) + Number(i.qty));
                }
                for (const [k, want] of requested) {
                    const have = avail.get(k) ?? 0;
                    if (want > have) {
                        throw new BadRequestException(`Not enough stock for one of the items (requested ${want}, available ${have}).`);
                    }
                }
            }
        }
    }

    /** the open shift a bill of this store belongs to: the store's one open shift, or in a staff-based store the serving person's own */
    private async openShiftFor(transactionManager: EntityManager, storeid: number | null, actingUserid: number | undefined, userid: number) {
        let shiftid: number | null = null;
        let staffBased = false;
        if (storeid) {
            const profile = await loadStoreProfile(transactionManager, storeid);
            staffBased = profile?.shiftmode === 'staff';
            const shiftRows = staffBased
                ? await transactionManager.query(
                    `select id from store_shifts where store_id = $1 and status = 'OPEN' and assigned_user_id = $2 order by shift_date desc, id desc limit 1`,
                    [storeid, actingUserid || userid])
                : await transactionManager.query(
                    `select id from store_shifts where store_id = $1 and status = 'OPEN' order by shift_date desc, id desc limit 1`,
                    [storeid]);
            shiftid = shiftRows?.[0]?.id || null;
        }
        return { shiftid, staffBased };
    }

    async updateSale(sale: SalePayload & { id?: number }, userid: number, actingUserid?: number) {
        // Wrap entire sale update in transaction to maintain data consistency
        return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                // an issued tax invoice keeps its lines and total; its number is never taken from the client
                await assertIssuedBillUnchanged(transactionManager, sale);
                delete (sale as any).gstinvoiceno; delete (sale as any).gstbusinessid;

                const [before] = await transactionManager.query(
                    `select s.status, s.shift_id, s.store_id, sh.status as shift_status from sale s left join store_shifts sh on sh.id = s.shift_id where s.id = $1`, [sale.id]);
                if (!before) throw new BadRequestException('That bill does not exist.');
                const nowComplete = String(sale.status ?? before.status ?? '').toUpperCase() === 'COMPLETE';
                const wasComplete = String(before.status ?? '').toUpperCase() === 'COMPLETE';
                const storeid: number | null = before.store_id ? Number(before.store_id) : (sale.storeid ? Number(sale.storeid) : null);
                // the lines the client left out are removed with the rest of the update, so a refusal below leaves the bill as it was
                if (Array.isArray(sale.items)) {
                    const keep = sale.items.map((i: any) => Number(i.id)).filter((n: number) => Number.isFinite(n) && n > 0);
                    await transactionManager.query(`delete from sale_item where sale_id = $1 and not (id = any($2::int[]))`, [sale.id, keep]);
                }
                if (nowComplete) {
                    await this.guardCompleteBill(transactionManager, { ...sale, status: 'COMPLETE' }, Array.isArray(sale.items) ? sale.items : [], storeid, Number(sale.id));
                }
                // a parked bill completed now is a cash event: it must belong to an open shift so it is reconciled at close
                let completedInShift: number | null = null;
                // a draft parked while an earlier shift was open carries that shift's id: once that shift is closed the bill belongs to the shift it is completed in
                const parkedShiftOpen = !!before.shift_id && String(before.shift_status ?? '').toUpperCase() === 'OPEN';
                if (nowComplete && !wasComplete && storeid && !parkedShiftOpen) {
                    const found = await this.openShiftFor(transactionManager, storeid, actingUserid, userid);
                    if (!found.shiftid) throw new BadRequestException(found.staffBased ? 'Open your own shift before completing sales.' : 'Open a shift before completing sales.');
                    completedInShift = found.shiftid;
                    (sale as any).shiftid = found.shiftid;
                    (sale as any).storeid = storeid;
                }
                if (!(sale as any).buyergstin && !(sale as any).placeofsupply) { delete (sale as any).buyergstin; delete (sale as any).placeofsupply; }
                else await this.normaliseBuyer(transactionManager, sale);

                // Step 1: Update sale header
                const updatedSale = await transactionManager.save(Sale, {...sale, updatedby:userid, actinguserid: actingUserid || sale.actinguserid || userid});

                if (!updatedSale || !updatedSale.id) {
                    throw new Error('Failed to update sale header');
                }

                // Step 2: Update sale items
                if (sale.items && sale.items.length > 0) {
                    sale.items.forEach(i => {
                        i.saleid = updatedSale.id;
                    });
                    await transactionManager.save(SaleItem, sale.items);
                }
                const invoiceNo = await assignGstInvoice(transactionManager, updatedSale.id);       // a parked bill that is completed now
                if (invoiceNo) { updatedSale.gstinvoiceno = invoiceNo; }
                await recordStaffCredit(transactionManager, updatedSale, actingUserid || userid);
                await recordStoreCredit(transactionManager, updatedSale, actingUserid || userid);
                await recordCustomerDue(transactionManager, updatedSale, actingUserid || userid);
                await this.hooks.saved({ manager: transactionManager, sale, saved: updatedSale, items: sale.items || [], storeId: (updatedSale as any).storeid ?? null, userId: userid, actingUserId: actingUserid });

                // the cash of a parked bill reaches the drawer when it is completed: in the shift it was moved to, or the open shift it was already parked in
                const cashShift: number | null = completedInShift ?? (nowComplete && !wasComplete && parkedShiftOpen ? Number(before.shift_id) : null);
                if (cashShift && Number(updatedSale['cashamt'] || sale['cashamt'] || 0) > 0) {
                    await transactionManager.save(StoreCashAccount, {
                        transdate: new Date().toISOString().slice(0, 10),
                        category: 'SALE',
                        description: `Sale ${updatedSale['billno'] || updatedSale['id']}`,
                        deposit: Number(updatedSale['cashamt'] || sale['cashamt'] || 0),
                        withdraw: 0,
                        store: { id: storeid },
                        shift: { id: cashShift },
                    } as any);
                }

                // The client only needs the saved header before loading the detail route.
                return updatedSale;
            } catch (error) {
                // Transaction will automatically rollback on error; a refusal (400) is passed on as it is
                if (error instanceof HttpException) { throw error; }
                throw userError(error, 'update the bill');
            }
        });
    }
    async removeItemsByIds(ids:any){
        return await this.saleItemRepository.delete(ids);
    } 

    async removeItems(saleid){
        return await this.saleItemRepository.delete({saleid});
    } 
  
    async createItem(createSaleItemDto: CreateSaleItemDto, userid:any) {
        return this.saleItemRepository.save({...createSaleItemDto, createdby:userid});
    }

    async findSaleItemsForSaleWithAvailableQty(id:number){
        // sale_tax: the GST in force today for the product (what the till bills), beside product_taxpcnt (the batch's own) and tax_pcnt (what this line was saved at)
        const query = `select si.*, iv.*, public.gst_sale_rate(iv.product_id, iv.product_taxpcnt::double precision, current_date) as sale_tax from sale_item si
        inner join inventory_view iv on iv.purchase_itemid = si.purchase_item_id
        inner join sale s on s.id = si.sale_id
        where s.id = $1`;
        return await this.manager.query(query, [id]);
    }

    async findSavedSales(){
        const query = `
        select s.id, bill_no, c."name", c.mobile, s.created_on 
        from sale s left join customer c on s.customer_id = c.id 
        where s.status = 'PENDING' order by created_on desc`;
        return await this.manager.query(query);
    }
    
    async findAll(query: SaleListQuery, userid: number | null, currentUserId?: number): Promise<PaginatedResult<Sale>> {
        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10)));

        // Determine which stores this user is allowed to see
        let allowedStoreIds: number[] | null = null;
        if (currentUserId) {
            const assignments: { store_id: number }[] = await this.manager.query(
                `SELECT store_id FROM user_stores WHERE user_id = $1`, [currentUserId]
            );
            if (assignments.length > 0) {
                allowedStoreIds = assignments.map(a => a.store_id);
            }
        }

        const qb = this.saleRepository.createQueryBuilder("sale")
        .leftJoinAndSelect("sale.delivery", "delivery")
        .leftJoinAndSelect("sale.customer", "customer")
        .leftJoinAndSelect("sale.created", "created")
        .leftJoinAndSelect("sale.actinguser", "actinguser")
        .leftJoin("sale.shift", "shift")
        .select(['sale', 'customer', 'customer.name', 'customer.mobile', 'created.id', 'created.fullname', 'actinguser.id', 'actinguser.fullname', 'delivery'])
        .where('sale.active = :flag', { flag: true });

        if (userid) {
            qb.andWhere('(sale.acting_user_id = :uid OR sale.created_by = :uid)', { uid: userid });
        }

        // Store filtering: restrict to allowed stores, optionally narrowed by query param
        if (allowedStoreIds !== null) {
            if (query.storeid) {
                const requested = Number(query.storeid);
                const effective = allowedStoreIds.includes(requested) ? [requested] : [];
                if (effective.length === 0) return { data: [], total: 0, page, limit };
                qb.andWhere('COALESCE(sale.storeid, shift.storeid) IN (:...storeids)', { storeids: effective });
            } else {
                qb.andWhere('COALESCE(sale.storeid, shift.storeid) IN (:...storeids)', { storeids: allowedStoreIds });
            }
        } else if (query.storeid) {
            // Business Head with a specific store selected
            qb.andWhere('COALESCE(sale.storeid, shift.storeid) = :storeid', { storeid: Number(query.storeid) });
        }

        if (query.date) {
            qb.andWhere(
                `sale.billdate >= CAST(:con AS date) AND sale.billdate < CAST(:con AS date) + INTERVAL '1 day'`,
                { con: query.date },
            );
        }
        if (query.billno) {
            qb.andWhere(`sale.bill_no = :billno`, { billno: query.billno });
        }
        if (query.customer) {
            qb.andWhere(`customer.id = :cid`, { cid: query.customer });
        }
        if (query.status) {
            qb.andWhere(`sale.status = :st`, { st: query.status });
        }

        // the id breaks ties, so a bill is never skipped or repeated from one page to the next
        qb.orderBy('sale.updatedon', 'DESC').addOrderBy('sale.id', 'DESC').skip((page - 1) * limit).take(limit);
        const [data, total] = await qb.getManyAndCount();
        return { data, total, page, limit };
    }

    async findAllItems(query: SaleItemsQuery, userid: number | null | undefined) {
       const qb = await this.saleItemRepository.createQueryBuilder("item")
                    .leftJoinAndSelect("item.sale", "sale")
                    .leftJoinAndSelect("sale.customer", "customer")
                    .leftJoinAndSelect("item.purchaseitem", "purchaseitem")
                    .leftJoinAndSelect("purchaseitem.product", "product")
                    .select(['item','sale','customer','purchaseitem','product'])
                    .where('sale.status = :st', { st:'COMPLETE' })
                    .andWhere('sale.active = true AND sale.archive = false')
                    .andWhere('item.active = true AND item.archive = false')
                    if(query.product){
                        qb.andWhere('product.title ilike :prod', { prod: query.product+'%' });
                    } 
        if(query.category){
            qb.andWhere('product.category = :ctg', { ctg:query.category });
        }
        if(query.fromdate && query.todate){
            qb.andWhere(
                `sale.billdate >= CAST(:from AS date) AND sale.billdate < CAST(:to AS date) + INTERVAL '1 day'`,
                { from:query.fromdate,to:query.todate },
            );
        }
        // if(userid){
        //     qb.andWhere('sale.createdby = :uid', { uid:userid });
        // }
        
        if(query.props){
            query.props.forEach((p, idx) => {
                const key = String(p.id).replace(/[^a-zA-Z0-9_]/g, '');
                if(key){
                    qb.andWhere(`product.more_props->>'${key}' = :propval${idx}`, { [`propval${idx}`]: p.value });
                }
            });
        }
        qb.orderBy('sale.billdate','DESC')
        return qb.getMany();
    }

    async getStaffSummary(query: any, currentUserId?: number) {
        let allowedStoreIds: number[] | null = null;
        if (currentUserId) {
            const assignments: { store_id: number }[] = await this.manager.query(
                `SELECT store_id FROM user_stores WHERE user_id = $1`, [currentUserId]
            );
            if (assignments.length > 0) {
                allowedStoreIds = assignments.map(a => a.store_id);
            }
        }

        const params: any[] = [];
        const conditions: string[] = [
            `s.status = 'COMPLETE'`, `s.active = true`
        ];

        if (query.fromdate) {
            params.push(query.fromdate);
            conditions.push(`s.bill_date >= CAST($${params.length} AS date)`);
        }
        if (query.todate) {
            params.push(query.todate);
            conditions.push(`s.bill_date < CAST($${params.length} AS date) + INTERVAL '1 day'`);
        }

        if (query.storeid) {
            // a store that is not one of the person's own is refused, not silently shown
            if (allowedStoreIds !== null && !allowedStoreIds.includes(Number(query.storeid))) throw new ForbiddenException('That store is not one of yours.');
            params.push(Number(query.storeid));
            conditions.push(`coalesce(s.store_id, ss.store_id) = $${params.length}`);
        } else if (allowedStoreIds !== null) {
            params.push(allowedStoreIds);
            conditions.push(`coalesce(s.store_id, ss.store_id) = ANY($${params.length}::int[])`);
        }

        const where = conditions.join(' AND ');
        // each bill is counted once: its returns are added up per bill first, so a bill with many items or returns does not multiply its totals
        const sql = `
            SELECT
                au.id AS staff_id,
                au.full_name AS staff_name,
                COUNT(*)::int AS sales_count,
                COALESCE(SUM(s.cash_amount), 0) AS cash_total,
                COALESCE(SUM(s.digi_amount), 0) AS digi_total,
                COALESCE(SUM(s.total), 0) AS net_total,
                COALESCE(SUM(r.return_count), 0)::int AS return_count,
                COALESCE(SUM(r.return_value), 0) AS return_value
            FROM sale s
            LEFT JOIN app_user au ON au.id = s.acting_user_id
            LEFT JOIN store_shifts ss ON ss.id = s.shift_id
            LEFT JOIN (
                SELECT si.sale_id, COUNT(sri.id) AS return_count, SUM(sri.qty * si.price) AS return_value
                  FROM sale_item si JOIN sale_return_item sri ON sri.sale_item_id = si.id
                 GROUP BY si.sale_id
            ) r ON r.sale_id = s.id
            WHERE ${where}
            GROUP BY au.id, au.full_name
            ORDER BY net_total DESC
        `;
        return this.manager.query(sql, params);
    }

    getFormatDate(dt:Date){
        let mon = dt.getMonth()+1;
        let dat = dt.getDate();
        return dt.getFullYear() + '-' + (mon < 10 ? ('0'+mon) : mon) 
        + '-' + (dat < 10 ? ('0'+dat) : dat);
    }

    async getSaleReturnItems(saleId:any){
        const query = ` SELECT sri.sale_item_id, sri.qty FROM sale_return_item sri
        inner join sale_item si on si.id = sri.sale_item_id
        inner join sale s on s.id = si.sale_id and s.id = $1`;
        return await this.manager.query(query, [saleId]);
    }

    async getSalesByFreq(fromdate:string,freq:string,count:number){

        const dt = new Date(fromdate);
        let query = ''
        let params: any[] = []

        if(freq === 'daily'){
            const date = new Date(dt.setDate(dt.getDate()+1));
            const other = date.setDate(date.getDate()-count);
            const todate = this.getFormatDate(new Date(other));

            query = `select to_char(s.bill_date,'yyyy-mm-dd') as bill_dt, sum(s.digi_amount) as digital,
            sum(s.cash_amount) as cash, sum(s.total) as total, count(s.bill_no) as orders
            from sale s inner join
            (select date(generate_series($1::date,$2,'1 day')) as dt)x on to_char(s.bill_date,'yyyy-mm-dd') = x.dt::text
            and s.status = 'COMPLETE'
            group by to_char(s.bill_date,'yyyy-mm-dd');`
            params = [todate, fromdate];
        }
        else {
            const date = new Date();
            const other = date.setMonth((date.getMonth()-1)-count);
            const todate = this.getFormatDate(new Date(other));

            query = `
            select x.dt as bill_dt, sum(s.digi_amount) as digital, sum(s.cash_amount) as cash,
            sum(s.total) as total, count(s.bill_no) as orders
            from sale s inner join
            (select months($1,$2) as dt)x on x.dt::text = date_part('year',s.bill_date)||'-'||lpad(date_part('month',s.bill_date)::text,2,'0')
            and s.status = 'COMPLETE'
            group by x.dt
            order by x.dt;`
            params = [fromdate, todate];
        }
        return await this.manager.query(query, params);
    }

    async getSales(){
        return await this.manager.query(`   
        select s.id, s.bill_date, s.status , s.customer_id, c.name, c.mobile, ss.itemcount, ss.total 
        from sale s inner join 
        (select sale_id, count(*) as itemcount, sum(qty * price) as total from sale_item group by sale_id) ss on ss.sale_id = s.id
        inner join customer c on c.id = s.customer_id `);
    }

    async getReturns(){
        return await this.manager.query(`   
        select sri.id, si.sale_id, s.bill_no, s.bill_date, sri.created_on, sri.created_by, c."name", c.mobile, 
                si.purchase_item_id, p.title, si.batch, si.exp_date, 
                sri.qty, si.price, sri.reason, sri."comments", sri.status, sri.refund_mode, sri.refund_amount, sri.needs_inspection, sri.accepted_qty, sri.discarded_qty, sri.inspection_note, sri.settled_on, u.full_name as raised_by, su.full_name as settled_by_name, st.location as store 
                from sale_return_item sri inner join sale_item si on si.id = sri.sale_item_id 
                inner join sale s on s.id = si.sale_id 
                inner join product p on p.id = si.product_id 
                left join customer c on c.id = s.customer_id 
                left join app_user u on u.id = sri.created_by left join app_user su on su.id = sri.settled_by left join stores st on st.id = s.store_id
                order by sri.created_on desc`);
    }

    async getEligibleReturns(saleid:any){
        return await this.manager.query(`
            select si.id, p.title, si.batch, si.exp_date, si.price, coalesce(si.qty - returned.total,si.qty - returned.total,si.qty) as eligible,
                   coalesce(p.return_rule, crr.rule, 'FREE') as return_rule
            from sale_item si left join
            (SELECT sale_item_id, sum(sri.qty) as total FROM sale_return_item sri
            inner join sale_item si on si.id = sri.sale_item_id WHERE si.sale_id = $1 GROUP BY sale_item_id) returned ON returned.sale_item_id = si.id
            inner join sale s on s.id = si.sale_id and s.id = $1
            inner join product p on p.id = si.product_id
            left join stores st on st.id = s.store_id
            left join return_category_rule crr on crr.business_id = st.business_id and lower(crr.category) = lower(p.category)
            order by p.title`, [saleid]);
    }

    async getReturnItemToAdjust(saleReturnId:any){
        return await this.manager.query(`
        select sri.id, p.title, si.batch, si.exp_date, si.price, si.purchase_item_id as itemid, sri.qty, sri.reason, sri."comments", sri.refund_mode, sri.needs_inspection
        from sale_return_item sri
        inner join sale_item si on si.id = sri.sale_item_id
        inner join product p on p.id = si.product_id
        where sri.id = $1`, [saleReturnId]);
    }

    async findById(id:number){
        return await this.saleRepository.createQueryBuilder("sale")
        .leftJoinAndSelect("sale.customer", "customer")
        .leftJoinAndSelect("sale.items", "items")
        .leftJoinAndSelect("items.product", "product")
        .leftJoinAndSelect("sale.created", "created")
        .leftJoinAndSelect("sale.actinguser", "actinguser")
          .select(['sale','customer','items','product','created.id','created.fullname','actinguser.id','actinguser.fullname'])
          .where('sale.id = :id', { id })
          .getOne();
    }

    async findAllItemsBySale(id:string){
        return this.saleItemRepository.createQueryBuilder('si')
            .where('si.saleid = :id', { id })
            .getMany();
    }

    async findAllEligibleItemsToReturn(id:string){
        return await this.manager.query(
        `select s.sale_id, pii.id, p.title, pii.batch, pii.mfr_date, pii.exp_date, pii.sale_price, p.pack, x.net as balqty from sale_item s
        inner join
        (select sale_id as sid, purchase_item_id as pid, sum(qty) as net from sale_item si where sale_id = $1
        group by sale_id, purchase_item_id) x on x.sid = s.sale_id and x.pid = s.purchase_item_id and x.net > 0 and status is null
        inner join purchase_invoice_item pii on pii.id = s.purchase_item_id
        inner join product p on p.id = pii.product_id`, [id]);
    }

    async update(id: number, values: Partial<Sale>, userid: number) {
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.saleRepository.findOne({where:{id}});
            await transaction.update(Sale, id, {...obj, ...values, updatedby:userid});
        });
    } 

    async delete(id: number | string, userid: number) {
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const sale = await transaction.findOne(Sale, { where: { id: +id }, relations: ['delivery', 'items'] });
            if (!sale) {
                throw new Error('Sale not found');
            }
            if (sale.status !== 'PENDING' && sale.status !== 'NEW') {
                throw new Error('Only pending sales can be discarded');
            }
            await transaction.update(Sale, id, { isActive: false, isArchived: true, status: 'DISCARDED', updatedby: userid });
            await transaction.update(SaleItem, { saleid: Number(id) } as any, { isActive: false, isArchived: true, updatedby: userid });
            if (sale.delivery?.id) {
                await transaction.update(SaleDelivery, sale.delivery.id, { isActive: false, isArchived: true, updatedby: userid });
            }
        });
    } 
    
    /**
     * Voids a completed bill rung up by mistake, while its shift is still open. Nothing is deleted: the bill stays with status VOID, who and why;
     * stock comes back (it is counted from completed bills), the shift's cash is corrected with a reversing line, the staff / store credit the bill
     * used is put back, and a business pack marks what it wrote (the drug register lines are withdrawn). A tax invoice keeps its number.
     */
    async voidSale(id: number | string, reason: string, user: { id: number; roleid?: number }, canVoidAny: boolean, force = false) {
        const why = voidReasonProblem(reason);
        if (why) throw new BadRequestException(why);
        return this.manager.transaction(async (tx) => {
            const [sale] = await tx.query(
                `select s.id, s.status, s.shift_id, s.store_id, s.bill_no, s.cash_amount::float8 as cash, s.created_by, s.acting_user_id, s.customer_id, s.staff_credit_amount::float8 as staff_credit, s.staff_credit_user_id,
                        s.credit_amount::float8 as store_credit, s.due_amount::float8 as due_amount, sh.status as shift_status
                   from sale s left join store_shifts sh on sh.id = s.shift_id where s.id = $1 for update of s`, [+id]);
            if (!sale) throw new BadRequestException('Bill not found.');
            const [{ n: returns }] = await tx.query(
                `select count(*)::int as n from sale_return_item sri join sale_item si on si.id = sri.sale_item_id where si.sale_id = $1`, [+id]);
            const problem = voidProblem({
                status: sale.status, shiftId: sale.shift_id ? +sale.shift_id : null, shiftStatus: sale.shift_status, returns,
                isOwn: [sale.created_by, sale.acting_user_id].some((u: any) => u && +u === +user.id), canVoidAny, force,
            });
            if (problem) throw new BadRequestException(problem);
            const text = `${reason}`.trim();

            await tx.query(`update sale set status = 'VOID', voided_on = now(), voided_by = $2, void_reason = $3, updated_by = $2, updated_on = now() where id = $1`, [+id, user.id, text]);

            // stock is counted from the bill's lines that are active, so they are set aside (not removed: the voided bill still shows what was on it)
            await tx.query(`update sale_item set active = false, status = 'Void', updated_by = $2, updated_on = now() where sale_id = $1`, [+id, user.id]);

            // the shift's cash: the bill's cash came in as a SALE line, so a reversing line takes it out again
            if (+sale.cash > 0) {
                // a closed shift's cash is already counted: a force-void takes the cash out of the shift that is open now instead
                let cashShift: number | null = sale.shift_id ? +sale.shift_id : null;
                if (force && String(sale.shift_status ?? '').toUpperCase() !== 'OPEN') {
                    const [open] = await tx.query(`select id from store_shifts where store_id = $1 and status = 'OPEN' order by shift_date desc, id desc limit 1`, [sale.store_id]);
                    if (!open) throw new BadRequestException('Open a shift first: the cash of this bill goes back out of the drawer of the open shift.');
                    cashShift = +open.id;
                }
                await tx.save(StoreCashAccount, {
                    transdate: new Date().toISOString().slice(0, 10),
                    category: 'SALE_VOID',
                    description: `${force ? 'Force-void' : 'Void'} bill ${sale.bill_no || sale.id}`,
                    deposit: 0,
                    withdraw: +sale.cash,
                    store: { id: sale.store_id },
                    shift: { id: cashShift },
                } as any);
            }
            // credit the bill gave or used goes back
            if (+sale.staff_credit > 0 && sale.staff_credit_user_id) {
                await tx.query(
                    `insert into staff_credit_entry (user_id, kind, amount, period, sale_id, store_id, note, created_by) values ($1, 'ADJUSTMENT', $2, to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM'), $3, $4, $5, $6)`,
                    [sale.staff_credit_user_id, -sale.staff_credit, sale.id, sale.store_id, `Void bill ${sale.bill_no || sale.id}`, user.id]);
            }
            if (+sale.store_credit > 0 && sale.customer_id) {
                await tx.query(
                    `insert into customer_credit_entry (customer_id, kind, amount, sale_id, store_id, note, created_by) values ($1, 'ADJUSTMENT', $2, $3, $4, $5, $6)`,
                    [sale.customer_id, +sale.store_credit, sale.id, sale.store_id, `Void bill ${sale.bill_no || sale.id}`, user.id]);
            }
            if (+sale.due_amount > 0 && sale.customer_id) {
                await tx.query(
                    `insert into customer_due_entry (customer_id, kind, amount, sale_id, store_id, note, created_by) values ($1, 'ADJUSTMENT', $2, $3, $4, $5, $6)`,
                    [sale.customer_id, -sale.due_amount, sale.id, sale.store_id, `Void bill ${sale.bill_no || sale.id}`, user.id]);
            }
            await this.hooks.voided({ manager: tx, saleId: +id, storeId: sale.store_id ? +sale.store_id : null, userId: user.id, reason: text });
            return { id: +id, status: 'VOID', billno: sale.bill_no, cashreversed: +sale.cash > 0 ? +sale.cash : 0 };
        });
    }

    async removeItem(itemid: number | string, userid: number) {
        await this.saleItemRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.update(SaleItem, itemid, {isArchived:true, updatedby:userid});
        });
    }    

    async removeReturnItem(id:any){
        await this.saleReturnItemRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.delete(SaleReturnItem, id);
        });
    }    

}

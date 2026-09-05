import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";

import { EntityManager, Repository } from "typeorm";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductQtyChangeDto } from "./dto/create-product-qtychange.dto";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { Setting } from "src/entities/setting.entity";
import { StockCount } from "src/entities/stock-count.entity";

@Injectable()
export class StockService {

    constructor(@InjectEntityManager() private manager: EntityManager,
        @InjectRepository(ProductPriceChange) private readonly priceRepository: Repository<ProductPriceChange>,
        @InjectRepository(ProductQtyChange) private readonly qtyRepository: Repository<ProductQtyChange>,
        @InjectRepository(Setting) private readonly settingRepository: Repository<Setting>,
        @InjectRepository(StockCount) private readonly countRepository: Repository<StockCount>){}
    
        /** One row per (item, store) where that store currently holds a nonzero balance - a
         * batch split across stores (via transfer) must be cleared at each store it's actually
         * at, not just wherever it was originally received (inventory_view is business-wide). */
        async findPurchaseItemsWithAvailable(ids:number[]){
            if (!ids || ids.length === 0) return [];
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
            return await this.manager.query(`
                with touched_stores as (
                    select pii.id as purchase_itemid, pi.store_id as storeid
                    from purchase_invoice_item pii
                    inner join purchase_invoice pi on pi.id = pii.invoice_id
                    where pii.id in (${placeholders})
                    union
                    select pq.item_id as purchase_itemid, pq.store_id as storeid
                    from product_qtychange pq
                    where pq.item_id in (${placeholders}) and pq.store_id is not null
                )
                select
                    ts.purchase_itemid,
                    ts.storeid,
                    (case when pi.store_id = ts.storeid then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
                    - coalesce((select sum(si.qty) from sale_item si
                                inner join sale s on s.id = si.sale_id
                                where si.purchase_item_id = ts.purchase_itemid and si.active = true and si.archive = false
                                  and s.store_id = ts.storeid), 0)
                    + coalesce((select sum(pq2.qty) from product_qtychange pq2
                                where pq2.item_id = ts.purchase_itemid and coalesce(pq2.status, 'APPROVED') = 'APPROVED'
                                  and pq2.active = true and pq2.archive = false and pq2.store_id = ts.storeid), 0)
                    as available
                from touched_stores ts
                inner join purchase_invoice_item pii on pii.id = ts.purchase_itemid
                inner join purchase_invoice pi on pi.id = pii.invoice_id
                inner join product p on p.id = pii.product_id`, ids);
        }

        async findByCriteria(criteria:any){
            const params:any[] = [];
            let paramIndex = 1;
            const conditions:string[] = [
                'p.active = true',
                'p.archive = false',
                'pii.active = true',
                'pii.archive = false',
                'i.active = true',
                'i.archive = false',
            ];

            // When a store is given, "purchased"/"sold"/"adjusted" (and so "available") are scoped
            // to that store: the batch only counts where it was received, sales only count where they
            // happened, and adjustments (including transfer postings) only count where they were posted.
            // With no store given, behaviour is unchanged (business-wide), for every existing caller.
            let storeParamIndex: number | null = null;
            if(criteria['storeid']){
                storeParamIndex = paramIndex++;
                params.push(Number(criteria['storeid']));
            }
            const purchasedExpr = storeParamIndex
                ? `(case when i.store_id = $${storeParamIndex} then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)`
                : `(pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)`;
            const soldStoreFilter = storeParamIndex ? ` and s.store_id = $${storeParamIndex}` : '';
            const adjustedStoreFilter = storeParamIndex ? ` and pq.store_id = $${storeParamIndex}` : '';

            if(criteria['excludeItems'] && criteria['excludeItems'].length > 0){
                const placeholders = criteria['excludeItems'].map(() => `$${paramIndex++}`).join(',');
                conditions.push(`pii.id not in (${placeholders})`);
                params.push(...criteria['excludeItems']);
            }

            if(Object.prototype.hasOwnProperty.call(criteria, 'expired')){
                conditions.push(criteria['expired']
                    ? 'pii.exp_date < current_date + 30'
                    : '(pii.exp_date is null or pii.exp_date >= current_date + 30)');
            }

            if(criteria['id']){
                conditions.push(`p.id = $${paramIndex++}`);
                params.push(criteria['id']);
            }

            if(!criteria['id'] && criteria['title']){
                let titleCriteria = criteria['title'].startsWith('~') ? '%'+criteria['title'].substring(1) : criteria['title'];
                conditions.push(`(p.title ilike $${paramIndex}||'%' or p.more_props->>'composition' ilike $${paramIndex}||'%')`);
                params.push(titleCriteria);
                paramIndex++;
            }

            if(criteria['status']){
                let arr = criteria.status.split(',');
                const placeholders = arr.map(() => `$${paramIndex++}`).join(',');
                conditions.push(`pii.status in (${placeholders})`);
                params.push(...arr);
            }
            if(criteria['available']){
                conditions.push(`(${purchasedExpr} - sold.sold + adjusted.adjusted) > 0`);
            }

            let sql = `
                select
                    p.id,
                    p.title,
                    p.pack,
                    p.active,
                    i.invoice_date,
                    i.invoice_no,
                    pii.id as item_id,
                    pii.batch,
                    pii.exp_date,
                    pii.status,
                    pii.tax_pcnt,
                    pii.mrp_cost,
                    sold.last_sale_date,
                    (pii.exp_date < current_date + 30) as expired,
                    ${purchasedExpr} as purchased,
                    sold.sold,
                    adjusted.adjusted,
                    (${purchasedExpr} - sold.sold + adjusted.adjusted) as balance,
                    p.more_props,
                    pp.sale_price
                from product p
                inner join purchase_invoice_item pii
                    on pii.product_id = p.id
                inner join purchase_invoice i
                    on i.id = pii.invoice_id
                left join lateral (
                    select
                        coalesce(sum(si.qty), 0) as sold,
                        max(s.bill_date) as last_sale_date
                    from sale_item si
                    left join sale s on s.id = si.sale_id
                    where si.purchase_item_id = pii.id
                        and si.active = true
                        and si.archive = false${soldStoreFilter}
                ) sold on true
                left join lateral (
                    select coalesce(sum(pq.qty), 0) as adjusted
                    from product_qtychange pq
                    where pq.item_id = pii.id
                        and pq.active = true
                        and pq.archive = false
                        and coalesce(pq.status, 'APPROVED') = 'APPROVED'${adjustedStoreFilter}
                ) adjusted on true
                left join product_price2 pp
                    on pp.product_id = p.id
                    and pp.end_date > current_date
                    and pp.active = true
                    and pp.archive = false
                where ${conditions.join(' and ')}
                order by p.title, pii.exp_date`;

            if(criteria['limit'] && criteria['limit'] > 0){
                sql += ` limit $${paramIndex++}`;
                params.push(criteria['limit']);
            }

            return await this.manager.query(sql, params);
        }

        // async findByItems(ids:number[]){
        //     return await this.manager.query(`select iv.purchase_itemid, iv.available 
        //     from inventory_view iv where purchase_itemid in (${ids.join(',')})`);
        // }

        async findByProducts(ids:number[]){
            if (!ids || ids.length === 0) return [];
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
            return await this.manager.query(`
            select piv.*, p.more_props, pp.sale_price from product_items_view piv
            inner join product p on p.id = piv.id and p.id in (${placeholders})
            left join product_price2 pp on pp.product_id = piv.id where piv.expired = false and piv.balance > 0
            order by piv.exp_date asc`, ids);
        }

        // async findAvailableQty(prodid:number, batch:string, expdate:string){
        //     return await this.manager.query(`
        //     select 
        //         case 
        //             when life_left < 1 then 0 
        //             else available_qty end 
        //     from stock_view where product_id = ${prodid} and batch = '${batch}' and expdate = '${expdate}'`);
        // }

        // async getSaleItemAvailableQuantities(sale:Sale){
        //    const items = await this.manager.query(`
        //    select si.product_id, p.title, p.pack, p.more_props as props, si.batch, si.exp_date, sv.mrp_cost, 
        //    sv.tax_pcnt, si.price, si.qty, si.total::numeric,
        //    (case when life_left < 1 then 0 else available_qty end)::numeric
        //    from sale_item si inner join 
        //    stock_view sv on sv.product_id = si.product_id and sv.batch = si.batch and sv.expdate = si.exp_date 
        //    inner join product p on p.id = si.product_id 
        //    where si.sale_id = ${sale.id}`);
        // //    console.log(items);
        //    return {...sale, items};
        // }

        async getItemsWithStockData(sale:any) {
            if (!sale.items || sale.items.length === 0) return sale;

            const conditions:string[] = [];
            const params:any[] = [];
            let paramIndex = 1;

            sale.items.forEach((item:any) => {
                conditions.push(`(title = $${paramIndex} and batch = $${paramIndex+1} and exp_date = $${paramIndex+2})`);
                params.push(item.product.title, item.batch, item.expdate);
                paramIndex += 3;
            });

            const query = `select * from inventory_view where ${conditions.join(' or ')}`
            const stockdata = await this.manager.query(query, params);
            return sale;
        }

        async findAllReady(){
            return await this.manager.query(`select * from stock_view where sale_price > ptr_cost and (life_left is null or life_left >= 0) order by title`);
        }
        
    async findStockDemand(input:any){
        let query = `
        select distinct p.id, p.title, x.total_orders,
        x.sold_qty, y.avail_qty,
        x.start_order_date,
        x.end_order_date, x.days_span,
        round((x.days_span/x.days)*100) as days_pcnt,
        case
            when round((x.days_span/x.days)*100) > 60 then 'HIGH'
            when round((x.days_span/x.days)*100) > 30 and round((x.days_span/x.days)*100) <=60 then 'MEDIUM'
            when round((x.days_span/x.days)*100) <= 30 then 'LOW'
            else 'NONE'
        end as orders_freq,
        x.days_ago,
        case
            when x.days_ago >= 60 then 'LONG'
            when x.days_ago < 60 and x.days_ago >=30 then 'INTER'
            when x.days_ago < 30 then 'SHORT'
            else 'NONE'
            end as order_since
        from product p left join
        (select sv.product_id, sum(sale_qty) as sold_qty, count(sv.id) as total_orders, count(*) as orders,
        min(sale_date) as start_order_date, max(sale_date) as end_order_date,
        ((DATE_PART('day', (max(sale_date::timestamp with time zone) - min(sale_date::timestamp with time zone)))) + 1) as days_span,
        ((DATE_PART('day', ($1::timestamp with time zone - $2::timestamp with time zone))) + 1) as days,
        ((DATE_PART('day', ($1 - max(sale_date::timestamp with time zone)))) + 1) as days_ago
        from sale_view sv where sale_date >= $2 and sale_date < $1 group by sv.product_id) x on p.id = x.product_id
        inner join stock_view sv2 on sv2.product_id = p.id
        inner join (select product_id, sum(available_qty) as avail_qty from stock_view sv group by product_id) y on y.product_id = p.id`;
        if(input.orders_avail){
            query += ` where x.total_orders is not null`
        }

        return await this.manager.query(query, [input.enddt, input.begindt])
    }
         
    async findAllPriceAdjust() {
        const qb = this.priceRepository.createQueryBuilder('p')
        .leftJoinAndSelect("p.purchaseitem", "item")
        .leftJoinAndSelect("item.product", "product")
        .select(['p','item','product'])
            .where('p.isActive = :flag', { flag: true }).orderBy('p.createdon','DESC');
          return qb.getMany();
    }     

    async findAllQtyAdjust() {
        const qb = this.qtyRepository.createQueryBuilder('q')
        .leftJoinAndSelect("q.purchaseitem", "item")
        .leftJoinAndSelect("item.product", "product")
        .select(['q','item','product'])
            .where('q.isActive = :flag', { flag: true }).orderBy('q.createdon','DESC');
          return qb.getMany();
    } 

    async findQtyAudits() {
        const qb = this.qtyRepository.createQueryBuilder('q')
        .leftJoinAndSelect("q.purchaseitem", "item")
        .leftJoinAndSelect("item.product", "product")
        .select(['q','item','product'])
            .where('q.isActive = :flag', { flag: true })
            .andWhere(`coalesce(q.status, 'PENDING') = 'PENDING'`)
            .orderBy('q.createdon','DESC');
          return qb.getMany();
    }

    async findAllPriceByItem(id:number){
        return this.priceRepository.createQueryBuilder(`p`)
            .where('p.itemid = :id', { id }).getMany();
    }

    async updatePrice(id:any, values:any, userid){
        return this.priceRepository.update(id, {...values, updatedby:userid});
    }

    async findByItem(id){
        return await this.manager.query(`
        select * from stock_view where id = $1`, [id]);
    }   

    async createPrice(dto: CreateProductPriceDto, userid) {
        return this.priceRepository.save({...dto, createdby:userid});
    }
    
    /** The store a batch was originally received at - the default when an adjustment doesn't say otherwise. */
    private async resolveHomeStoreId(itemId: number): Promise<number | null> {
        const rows = await this.manager.query(`
            select pi.store_id from purchase_invoice_item pii
            inner join purchase_invoice pi on pi.id = pii.invoice_id
            where pii.id = $1`, [itemId]);
        return rows?.[0]?.store_id ?? null;
    }

    /** Best-known per-unit value for a batch, used to size an adjustment for the approval gate -
     * derived server-side rather than trusting a client-supplied price, which several existing
     * callers don't send at all. */
    private async resolveUnitValue(itemId: number): Promise<number> {
        const rows = await this.manager.query(`
            select coalesce(sale_price, mrp_cost, ptr_cost, 0) as value
            from purchase_invoice_item where id = $1`, [itemId]);
        return Number(rows?.[0]?.value || 0);
    }

    /** WS-3: adjustments valued above this go to PENDING instead of applying immediately.
     * Fixed-in-code default, overridable via the same Setting mechanism as the PO approval threshold. */
    private async getStockAdjustmentApprovalValueThreshold(): Promise<number> {
        const setting = await this.settingRepository.findOne({
            where: { key: 'stock_adjustment_approval_value_threshold', isActive: true, isArchived: false }
        });
        const parsed = Number(setting?.value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000;
    }

    /** Resolves the status for a new/edited adjustment: an explicit status always wins (bulk
     * clearance and the audit workflow rely on this); otherwise gate on estimated value. */
    private async resolveAdjustmentStatus(explicitStatus: string | undefined, itemId: number, qty: any): Promise<string> {
        if (explicitStatus) {
            return explicitStatus;
        }
        const unitValue = await this.resolveUnitValue(itemId);
        const estimatedValue = Math.abs(Number(qty || 0)) * unitValue;
        const threshold = await this.getStockAdjustmentApprovalValueThreshold();
        return estimatedValue > threshold ? 'PENDING' : 'APPROVED';
    }

    async createQty(dto: CreateProductQtyChangeDto, userid) {
        if (!dto.itemid || !Number.isFinite(Number(dto.qty)) || Number(dto.qty) === 0) {
            throw new BadRequestException('A batch and a non-zero quantity are required.');
        }
        const storeid = dto.storeid ?? await this.resolveHomeStoreId(dto.itemid);
        const reasoncode = dto.reasoncode || (dto as any).reason || null;
        // `reason` is NOT NULL in the DB; older callers always sent it, but a reasoncode-only
        // caller (any new integration) must still satisfy that constraint.
        const reason = (dto as any).reason || dto.reasoncode;
        const status = await this.resolveAdjustmentStatus(dto.status, dto.itemid, dto.qty);
        return this.qtyRepository.save({...dto, reason, reasoncode, storeid, status, createdby:userid});
    }

    async createStockAdjustments(items: CreateProductQtyChangeDto[], userid) {
        const payload = await Promise.all(items.map(async item => ({
            ...item,
            reason: (item as any).reason || item.reasoncode,
            reasoncode: item.reasoncode || (item as any).reason || null,
            storeid: item.storeid ?? await this.resolveHomeStoreId(item.itemid),
            status: await this.resolveAdjustmentStatus(item.status, item.itemid, item.qty),
            createdby: userid
        })));
        return this.qtyRepository.save(payload);
    }

    async updateQtyAdjustment(id: any, dto: any, userid: any) {
        const existing = await this.qtyRepository.findOne({ where: { id } });
        if (!existing) {
            throw new NotFoundException('Adjustment not found.');
        }
        const qty = dto.qty !== undefined ? dto.qty : existing.qty;
        if (!Number.isFinite(Number(qty)) || Number(qty) === 0) {
            throw new BadRequestException('Quantity must be a non-zero number.');
        }
        const reasoncode = dto.reasoncode || dto.reason || existing.reasoncode;
        const status = await this.resolveAdjustmentStatus(dto.status, existing.itemid, qty);
        await this.qtyRepository.update(id, {
            qty,
            reason: dto.reason ?? existing.reason,
            reasoncode,
            comments: dto.comments ?? existing.comments,
            status,
            updatedby: userid,
        } as any);
        return this.qtyRepository.findOne({ where: { id } });
    }

    async createStockAudit(items: any[], userid) {
        const payload = await Promise.all((items || []).map(async (item) => ({
            itemid: item.itemid,
            qty: (+item.countedqty || 0) - (+item.bookqty || 0),
            price: item.price ?? 0,
            reason: item.reason || 'AUDIT',
            reasoncode: item.reasoncode || 'AUDIT',
            comments: item.comments || `book:${item.bookqty ?? 0};counted:${item.countedqty ?? 0}`,
            status: 'PENDING',
            storeid: item.storeid ?? await this.resolveHomeStoreId(item.itemid),
            countid: item.countid ?? null,
            createdby: userid
        })));
        return this.qtyRepository.save(payload);
    }

    async approveQtyAudit(id:any, userid:any) {
        return this.qtyRepository.update(id, {status:'APPROVED', updatedby:userid});
    }

    async rejectQtyAudit(id:any, userid:any) {
        return this.qtyRepository.update(id, {status:'REJECTED', updatedby:userid});
    }

    /** WS-5: cycle count / physical stock take. A count is a header grouping a batch of
     * count lines; the lines reuse the existing audit ledger (always PENDING, same
     * manager approve/reject flow as any other audit row - counts are discovered
     * discrepancies, so they always get a human look, same as a manual audit today). */
    async startCount(body: any, userid: number) {
        const storeid = body.storeid ? Number(body.storeid) : null;
        const count = await this.countRepository.save({
            category: body.category || null,
            storeid,
            startedby: userid,
            startedon: new Date(),
            status: 'IN_PROGRESS',
        } as any);
        const items = await this.getCountSnapshot(body.category, storeid);
        return { count, items };
    }

    /** Store-scoped snapshot, same formula as findByCriteria's storeid path: a batch only
     * counts where it was received, at the store the count is actually being done. With no
     * storeid (a global count) this falls back to the pre-WS-6 business-wide balance. */
    private async getCountSnapshot(category?: string, storeid?: number | null) {
        return this.manager.query(`
            select * from (
                select
                    pii.id as item_id,
                    p.title,
                    pii.batch,
                    p.category,
                    (case when $2::int is null or pi.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
                    - coalesce((select sum(si.qty) from sale_item si
                                inner join sale s on s.id = si.sale_id
                                where si.purchase_item_id = pii.id and si.active = true and si.archive = false
                                  and ($2::int is null or s.store_id = $2)), 0)
                    + coalesce((select sum(pq.qty) from product_qtychange pq
                                where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED'
                                  and pq.active = true and pq.archive = false
                                  and ($2::int is null or pq.store_id = $2)), 0)
                    as balance
                from purchase_invoice_item pii
                inner join purchase_invoice pi on pi.id = pii.invoice_id
                inner join product p on p.id = pii.product_id
                where pii.active = true and pii.archive = false
                  and pi.active = true and pi.archive = false
                  and p.active = true and p.archive = false
                  and ($1::text is null or p.category = $1)
            ) x
            where x.balance > 0
            order by x.title, x.batch`, [category || null, storeid ?? null]);
    }

    async submitCount(id: number, items: any[], userid: number) {
        const count = await this.countRepository.findOne({ where: { id } });
        if (!count) {
            throw new NotFoundException('Count not found.');
        }
        if (count.status !== 'IN_PROGRESS') {
            throw new BadRequestException('This count is already completed.');
        }

        // attribute every resulting adjustment to the store the count was actually done at
        // (falls back to the batch's home store via createStockAudit when the count itself
        // wasn't scoped to a store).
        const changed = (items || []).filter((i: any) => Number(i.countedqty) !== Number(i.bookqty));
        const adjustments = changed.length
            ? await this.createStockAudit(changed.map((i: any) => ({ ...i, countid: id, storeid: i.storeid ?? count.storeid })), userid)
            : [];

        await this.countRepository.update(id, {
            status: 'COMPLETED',
            completedby: userid,
            completedon: new Date(),
        } as any);

        return { linesCounted: (items || []).length, linesChanged: changed.length, adjustments };
    }

    async findCounts() {
        const counts = await this.countRepository.find({
            relations: ['starteduser', 'completeduser'],
            order: { startedon: 'DESC' },
        });
        const ids = counts.map((c) => c.id);
        if (!ids.length) {
            return [];
        }
        const stats = await this.manager.query(`
            select count_id, count(*)::int as line_count, coalesce(sum(abs(qty)), 0) as total_qty_change
            from product_qtychange where count_id = any($1::int[]) group by count_id`, [ids]);
        const byId = new Map<number, any>(stats.map((s: any) => [Number(s.count_id), s]));
        return counts.map((c) => ({
            ...c,
            linecount: Number(byId.get(c.id)?.line_count || 0),
            totalqtychange: Number(byId.get(c.id)?.total_qty_change || 0),
        }));
    }

    async findCountDetail(id: number) {
        const count = await this.countRepository.findOne({ where: { id }, relations: ['starteduser', 'completeduser'] });
        if (!count) {
            throw new NotFoundException('Count not found.');
        }
        const lines = await this.qtyRepository.createQueryBuilder('q')
            .leftJoinAndSelect('q.purchaseitem', 'item')
            .leftJoinAndSelect('item.product', 'product')
            .where('q.countid = :id', { id })
            .orderBy('q.createdon', 'ASC')
            .getMany();
        return { count, lines };
    }
    // async findByCriteria(criteria){
    //     let query = `select * from stock_view`;
    //     if(criteria) {
    //         query += `where `
    //         query += criteria.expired && `life_left > 0`
    //     }
    //     return await this.manager.query(query);
    // }

    async deleteQtyAdjustment(id:any){
        await this.qtyRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.delete(ProductQtyChange, id);
        });
    }
}

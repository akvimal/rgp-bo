import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";

import { EntityManager, Repository } from "typeorm";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductQtyChangeDto } from "./dto/create-product-qtychange.dto";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { getExpiryThresholdDays } from "src/core/config/expiry-threshold";

@Injectable()
export class StockService {

    constructor(@InjectEntityManager() private manager: EntityManager,
        @InjectRepository(ProductPriceChange) private readonly priceRepository: Repository<ProductPriceChange>,
        @InjectRepository(ProductQtyChange) private readonly qtyRepository: Repository<ProductQtyChange>){}
    
        async findPurchaseItemsWithAvailable(ids:number[]){
            if (!ids || ids.length === 0) return [];
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
            return await this.manager.query(`
            select purchase_itemid, available from inventory_view iv where iv.purchase_itemid in (${placeholders})`, ids);
        }

        async findByCriteria(criteria:any){
            const expiryThresholdDays = getExpiryThresholdDays();
            const params:any[] = [expiryThresholdDays];
            let paramIndex = 2;
            const conditions:string[] = [
                'p.active = true',
                'p.archive = false',
                'pii.active = true',
                'pii.archive = false',
                'i.active = true',
                'i.archive = false',
            ];

            if(criteria['excludeItems'] && criteria['excludeItems'].length > 0){
                const placeholders = criteria['excludeItems'].map(() => `$${paramIndex++}`).join(',');
                conditions.push(`pii.id not in (${placeholders})`);
                params.push(...criteria['excludeItems']);
            }

            if(Object.prototype.hasOwnProperty.call(criteria, 'expired')){
                conditions.push(criteria['expired']
                    ? 'pii.exp_date < current_date + $1::int'
                    : '(pii.exp_date is null or pii.exp_date >= current_date + $1::int)');
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
                conditions.push(`(
                    (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)
                    - sold.sold + adjusted.adjusted
                ) > 0`);
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
                    (pii.exp_date < current_date + $1::int) as expired,
                    (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) as purchased,
                    sold.sold,
                    adjusted.adjusted,
                    (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)
                        - sold.sold + adjusted.adjusted as balance,
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
                        and si.archive = false
                ) sold on true
                left join lateral (
                    select coalesce(sum(pq.qty), 0) as adjusted
                    from product_qtychange pq
                    where pq.item_id = pii.id
                        and pq.active = true
                        and pq.archive = false
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
            const expiryThresholdDays = getExpiryThresholdDays();
            const placeholders = ids.map((_, index) => `$${index + 2}`).join(',');
            return await this.manager.query(`
            select piv.*, p.more_props, pp.sale_price from product_items_view piv
            inner join product p on p.id = piv.id and p.id in (${placeholders})
            left join product_price2 pp on pp.product_id = piv.id
            where (piv.exp_date is null or piv.exp_date >= current_date + $1::int) and piv.balance > 0
            order by piv.exp_date asc`, [expiryThresholdDays, ...ids]);
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
    
    async createQty(dto: CreateProductQtyChangeDto, userid) {
        return this.qtyRepository.save({...dto, createdby:userid});
    }

    async createStockAdjustments(items: CreateProductQtyChangeDto[], userid) {
        items.forEach(item => {
            item['createdby'] = userid;
        })
        return this.qtyRepository.save(items);
        // return this.qtyRepository.save({...dto, createdby:userid});
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

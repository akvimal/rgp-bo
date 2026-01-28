import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";

import { DataSource, EntityManager, Repository } from "typeorm";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductQtyChangeDto } from "./dto/create-product-qtychange.dto";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";

@Injectable()
export class StockService {

    constructor(@InjectEntityManager() private manager: EntityManager,
        @InjectRepository(ProductPriceChange) private readonly priceRepository: Repository<ProductPriceChange>,
        @InjectRepository(ProductQtyChange) private readonly qtyRepository: Repository<ProductQtyChange>,
        private dataSource: DataSource){}
    
        async findPurchaseItemsWithAvailable(ids:number[]){
            if (!ids || ids.length === 0) return [];
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
            return await this.manager.query(`
            select purchase_itemid, available from inventory_view iv where iv.purchase_itemid in (${placeholders})`, ids);
        }

        async findByCriteria(criteria:any){

            let sql =
            `select piv.*, p.more_props, pp.sale_price from product_items_view piv
            inner join product p on p.id = piv.id `;

            const params:any[] = [];
            let paramIndex = 1;

            if(criteria['excludeItems'] && criteria['excludeItems'].length > 0){
                const placeholders = criteria['excludeItems'].map(() => `$${paramIndex++}`).join(',');
                sql += ` and piv.item_id not in (${placeholders}) `
                params.push(...criteria['excludeItems']);
            }
            sql += `left join product_price2 pp on pp.product_id = piv.id and pp.end_date > current_date `;

            const conditions:string[] = [];
            if(criteria['expired']){
                conditions.push(`piv.expired = $${paramIndex++}`)
                params.push(criteria['expired']);
            }

            if(criteria['id']){
                conditions.push(`piv.id = $${paramIndex++}`);
                params.push(criteria['id']);
            }

            if(!criteria['id'] && criteria['title']){
                let titleCriteria = criteria['title'].startsWith('~') ? '%'+criteria['title'].substring(1) : criteria['title'];
                conditions.push(`(piv.title ilike $${paramIndex}||'%' or p.more_props->>'composition' ilike $${paramIndex}||'%')`);
                params.push(titleCriteria);
                paramIndex++;
            }

            if(criteria['status']){
                let arr = criteria.status.split(',');
                const placeholders = arr.map(() => `$${paramIndex++}`).join(',');
                conditions.push(`piv.status in (${placeholders})`);
                params.push(...arr);
            }
            if(criteria['expired'])
                conditions.push('piv.exp_date < current_date')
            if(criteria['available'])
                conditions.push('piv.balance > 0')

            if(conditions.length > 0){
                sql += ' where ' + conditions.join(' and ');
            }

            sql += ` order by piv.title, piv.exp_date`
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
    
    /**
     * Create stock quantity adjustment
     * Fix for issue #60: Validate negative adjustments don't make stock go below zero
     * Fix for issue #13: Pessimistic locking to prevent concurrent adjustment race conditions
     */
    async createQty(dto: CreateProductQtyChangeDto, userid) {
        // Wrap in SERIALIZABLE transaction with row-level locking
        return await this.dataSource.transaction('SERIALIZABLE', async (transactionManager) => {
            // Lock the inventory row using SELECT FOR UPDATE to prevent concurrent modifications
            // This ensures that only one transaction can modify this stock at a time
            const stockCheck = await transactionManager.query(
                `SELECT purchase_itemid, available
                 FROM inventory_view
                 WHERE purchase_itemid = $1
                 FOR UPDATE`,
                [dto.itemid]
            );

            if (!stockCheck || stockCheck.length === 0) {
                throw new Error(`Stock not found for item ID ${dto.itemid}`);
            }

            const currentStock = stockCheck[0].available;
            const newStock = currentStock + dto.qty; // dto.qty can be positive or negative

            // Validate that adjustment won't result in negative stock
            if (newStock < 0) {
                throw new Error(
                    `Invalid adjustment: Cannot reduce stock below zero. ` +
                    `Current: ${currentStock}, Adjustment: ${dto.qty}, Would result in: ${newStock}`
                );
            }

            // Create the adjustment record
            // The lock will be held until the transaction commits, preventing race conditions
            const adjustment = await transactionManager.save(ProductQtyChange, {
                ...dto,
                createdby: userid
            });

            return adjustment;
        });
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
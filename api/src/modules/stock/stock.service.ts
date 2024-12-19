import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";

import { ProductPriceChange } from "../../entities/product-pricechange.entity";
import { ProductQtyChange } from "../../entities/product-qtychange.entity";
import { Sale } from "../../entities/sale.entity";
import { EntityManager, Repository } from "typeorm";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductQtyChangeDto } from "./dto/create-product-qtychange.dto";

@Injectable()
export class StockService {

    constructor(@InjectEntityManager() private manager: EntityManager,
        @InjectRepository(ProductPriceChange) private readonly priceRepository: Repository<ProductPriceChange>,
        @InjectRepository(ProductQtyChange) private readonly qtyRepository: Repository<ProductQtyChange>){}
    
        async findPurchaseItemsWithAvailable(ids:number[]){
            return await this.manager.query(`
            select purchase_itemid, available from inventory_view iv where iv.purchase_itemid in (${ids.join(',')})`);
        }

        async findByCriteria(criteria:any){
            
            let sql = 
            `select piv.*, p.more_props, pp.sale_price from product_items_view piv 
            inner join product p on p.id = piv.id `;
            if(criteria['excludeItems'] && criteria['excludeItems'].length > 0){
                sql += ` and piv.item_id not in (${criteria['excludeItems'].join(',')}) `
            }
            sql += `left join product_price2 pp on pp.product_id = piv.id and pp.end_date > current_date `;

            const conditions = [];
            if(criteria['expired'])
                conditions.push(`piv.expired = ${criteria['expired']}`)

            if(criteria['id'])
                conditions.push(`piv.id = ${criteria['id']}`);

            if(!criteria['id'] && criteria['title']){
                let titleCriteria = criteria['title'].startsWith('~') ? '%'+criteria['title'].substring(1).replaceAll('\'','\,\,') : criteria['title'].replaceAll('\'','\,\,');
                conditions.push(`(piv.title ilike '${titleCriteria}%' or p.more_props->>'composition' ilike '${titleCriteria}%')`);
            }

            if(criteria['status']){
                let arr = criteria.status.split(',');
                criteria.status = arr.map(a => '\'' + a + '\'');
                conditions.push(`piv.status in (${criteria.status})`);
            }
            if(criteria['expired'])
                conditions.push('piv.exp_date < current_date')
            if(criteria['available'])
                conditions.push('piv.balance > 0')
            
            if(conditions.length > 0){
                sql += ' where ' + conditions.join(' and ');
            }            
                
            sql += ` order by piv.title, piv.exp_date ${criteria['limit'] > 0 ? 'limit '+ criteria['limit'] : ''}`

            return await this.manager.query(sql);
        }

        // async findByItems(ids:number[]){
        //     return await this.manager.query(`select iv.purchase_itemid, iv.available 
        //     from inventory_view iv where purchase_itemid in (${ids.join(',')})`);
        // }

        async findByProducts(ids:number[]){
            return await this.manager.query(`
            select piv.*, p.more_props, pp.sale_price from product_items_view piv 
            inner join product p on p.id = piv.id and p.id in (${ids.join(',')})
            left join product_price2 pp on pp.product_id = piv.id where piv.expired = false and piv.balance > 0
            order by piv.exp_date asc`);
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

        async getItemsWithStockData(sale:Sale) {

            const products = sale.items.map((item:any) => { return `(title='${item.product.title.replaceAll('\'','\'\'')}' and batch='${item.batch}' and exp_date='${item.expdate}')`});
            const query = `select * from inventory_view where ${products.join(' or ')}`
            const stockdata = await this.manager.query(query);
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
        ((DATE_PART('day', ('${input.enddt}'::timestamp with time zone - '${input.begindt}'::timestamp with time zone))) + 1) as days,
        ((DATE_PART('day', ('${input.enddt}' - max(sale_date::timestamp with time zone)))) + 1) as days_ago
        from sale_view sv where sale_date >= '${input.begindt}' and sale_date < '${input.enddt}' group by sv.product_id) x on p.id = x.product_id
        inner join stock_view sv2 on sv2.product_id = p.id
        inner join (select product_id, sum(available_qty) as avail_qty from stock_view sv group by product_id) y on y.product_id = p.id`;
        if(input.orders_avail){
            query += ` where x.total_orders is not null`
        }
        
        return await this.manager.query(query)
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
        select * from stock_view where id = ${id}`);
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
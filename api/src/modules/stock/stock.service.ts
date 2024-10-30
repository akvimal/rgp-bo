import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import exp from "constants";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { Sale } from "src/entities/sale.entity";
import { EntityManager, Repository } from "typeorm";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductQtyChangeDto } from "./dto/create-product-qtychange.dto";

@Injectable()
export class StockService {

    constructor(@InjectEntityManager() private manager: EntityManager,
        @InjectRepository(ProductPriceChange) private readonly priceRepository: Repository<ProductPriceChange>,
        @InjectRepository(ProductQtyChange) private readonly qtyRepository: Repository<ProductQtyChange>){}
    
        async findAll(){
            return await this.manager.query(`
            select * from stock_view where (life_left is null or life_left >= 0) order by title`);
        }

        async findByCriteria(query:any){
            return await this.manager.query(`
            select iv.*, sale_price, market_price 
            from inventory_view iv left join product_price2 pp on pp.product_id = iv.product_id 
            where available > 0 and product_expdate > current_timestamp and product_title ilike '%${query.query}%' order by product_title, product_expdate ${query.limit > 0 ? 'limit '+query.limit : ''}`);
        }

        async findByItems(ids:number[]){
            return await this.manager.query(`select iv.purchase_itemid, iv.available 
            from inventory_view iv where purchase_itemid in (${ids.join(',')})`);
        }

        async findByProducts(ids:number[]){
            return await this.manager.query(`select iv.*, sale_price, market_price 
            from inventory_view iv left join product_price2 pp on pp.product_id = iv.product_id 
            where  iv.product_id in (${ids.join(',')}) and product_expdate > current_timestamp and available > 0 order by product_expdate`);
        }

        async findAvailableQty(prodid:number, batch:string, expdate:string){
            return await this.manager.query(`
            select 
                case 
                    when life_left < 1 then 0 
                    else available_qty end 
            from stock_view where product_id = ${prodid} and batch = '${batch}' and expdate = '${expdate}'`);
        }

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
            console.log(products);
            
            const query = `select * from inventory_view where ${products.join(' or ')}`
            console.log(query);
            
            const stockdata = await this.manager.query(query);
            console.log(stockdata);
            

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
    // async findByCriteria(criteria){
    //     let query = `select * from stock_view`;
    //     if(criteria) {
    //         query += `where `
    //         query += criteria.expired && `life_left > 0`
    //     }
    //     return await this.manager.query(query);
    // }
}
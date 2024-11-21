import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { SaleItem } from "src/entities/sale-item.entity";
import { Sale } from "src/entities/sale.entity";
import { Repository } from "typeorm";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { CreateSaleReturnItemDto } from "./dto/create-salereturnitem.dto";
import { SaleReturnItem } from "src/entities/salereturn-item.entity";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturnitem.dto";

@Injectable()
export class SaleService {

    constructor(@InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem) private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(SaleReturnItem) private readonly saleReturnItemRepository: Repository<SaleReturnItem>,
    @InjectEntityManager() private manager: EntityManager) { }

    async create(sale:any,userid:any) {
        
        const nos = await this.manager.query(`select generate_order_number() as order_no, generate_bill_number() as bill_no`);
      
        sale['orderno'] = nos[0]['order_no'];
        sale['orderdate'] = new Date();
        sale['billno'] = nos[0]['bill_no'];
        
        return this.saleRepository.save({...sale, createdby:userid}).then(data => {
            data.items.forEach(i => {
                i.saleid = data.id;
            });
            return this.saleItemRepository.save(data.items).then(d => {
                return new Promise(async (resolve,reject)=>{
                    const sale = await this.findById(data.id);
                    resolve(sale);
                })
            })
        });
    }

    async createReturnItems(items:CreateSaleReturnItemDto[],userid:any){
        items.forEach(item => {
            item['createdby'] = userid;
        })
        return this.saleReturnItemRepository.save(items);
    }

    async updateReturnItem(item:UpdateSaleReturnItemDto,userid:any){
        item['updatedby'] = userid;
        return this.saleReturnItemRepository.save(item);
    }


    async updateSale(sale:any,userid:any) {
        
        return this.saleRepository.save({...sale, updatedby:userid}).then(result => {
            result.items.forEach(i => {
                i.saleid = result.id;
            })
            return this.saleItemRepository.save(sale.items).then(itemsResult => {
                return new Promise(async (resolve,reject)=>{
                    const sale = await this.findById(result.id);
                    resolve(sale);
                })
            })
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
        const query = `select si.*, iv.* from sale_item si 
        inner join inventory_view iv on iv.purchase_itemid = si.purchase_item_id 
        inner join sale s on s.id = si.sale_id 
        where s.id = ${id}`;
        return await this.manager.query(query);
    }

    async findSavedSales(){
        const query = `
        select s.id, bill_no, c."name", c.mobile, s.created_on 
        from sale s left join customer c on s.customer_id = c.id 
        where s.status = 'PENDING' order by created_on desc`;
        return await this.manager.query(query);
    }
    
    async findAll(query:any,userid:any){
        const qb = this.saleRepository.createQueryBuilder("sale")
                    .leftJoinAndSelect("sale.customer", "customer")
                    .leftJoinAndSelect("sale.created", "created")
                    .select(['sale','customer','customer.name','customer.mobile','created.id','created.fullname'])
                    .where('sale.active = :flag', { flag:true }); 
        if(userid){
            qb.andWhere('sale.createdby = :uid', { uid:userid });
        }
        if(query.date){
            qb.andWhere(`DATE_TRUNC('day', sale.billdate) = :con`, { con:query.date });
        }
        if(query.billno){
            qb.andWhere(`sale.bill_no = :billno`, { billno:query.billno });
        }
        if(query.customer){
            qb.andWhere(`customer.id = :cid`, { cid:query.customer });
        }
        if(query.status){
            qb.andWhere(`sale.status = :st`, { st:query.status });
        }
        qb.orderBy('sale.updatedon','DESC')
        return qb.getMany();
    }

    async findAllItems(query:any,userid:any){        
       const qb = await this.saleItemRepository.createQueryBuilder("item")
                    .leftJoinAndSelect("item.sale", "sale")
                    .leftJoinAndSelect("sale.customer", "customer")
                    .leftJoinAndSelect("item.purchaseitem", "purchaseitem")
                    .leftJoinAndSelect("purchaseitem.product", "product")
                    .select(['item','sale','customer','purchaseitem','product'])
                    .where('sale.status = :st', { st:'COMPLETE' })
                    if(query.product){
                        qb.andWhere('product.title ilike :prod', { prod: query.product+'%' });
                    } 
        if(query.category){
            qb.andWhere('product.category = :ctg', { ctg:query.category });
        }        
        if(query.fromdate && query.todate){
            qb.andWhere('sale.billdate >= :from and sale.billdate <= :to', { from:query.fromdate,to:query.todate });
        }
        // if(userid){
        //     qb.andWhere('sale.createdby = :uid', { uid:userid });
        // }
        
        if(query.props){
            query.props.forEach(p => {
                qb.andWhere(`product.more_props->>'${p.id}' = :value`, { value: p.value });
            })
        }
        qb.orderBy('sale.billdate','DESC')
        return qb.getMany();
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
        inner join sale s on s.id = si.sale_id and s.id = ${saleId}`;
        return await this.manager.query(query);
    }

    async getSalesByFreq(fromdate:string,freq:string,count:number){
   
        const dt = new Date(fromdate);
        let query = ''

        if(freq === 'daily'){
            const date = new Date(dt.setDate(dt.getDate()+1));
            const other = date.setDate(date.getDate()-count);
            const todate = this.getFormatDate(new Date(other));
            // query = `select to_char(x.dt,'yyyy-mm-dd') as date, 
            // sum(sv.sale_total) as sale, count(sv.id) as orders 
            // from (select date(generate_series('${todate}'::date,'${fromdate}','1 day')) as dt)x 
            // left join sale_view sv on x.dt = sv.sale_date 
            // group by x.dt order by x.dt`

            query = `select to_char(s.bill_date,'yyyy-mm-dd') as bill_dt, sum(s.digi_amount) as digital, 
            sum(s.cash_amount) as cash, sum(s.total) as total, count(s.bill_no) as orders 
            from sale s inner join 
            (select date(generate_series('${todate}'::date,'${fromdate}','1 day')) as dt)x on to_char(s.bill_date,'yyyy-mm-dd') = x.dt::text
            and s.status = 'COMPLETE'
            group by to_char(s.bill_date,'yyyy-mm-dd');`
        }
        else {
            const date = new Date();
            const other = date.setMonth((date.getMonth()-1)-count);
            const todate = this.getFormatDate(new Date(other));
            // query = `select x.d2 as date, 
            // sum(sv.sale_total) as sale, count(sv.id) as orders 
            // from (select months('${fromdate}','${todate}') as d2) x
            // left join sale_view sv on x.d2 = date_part('year',sv.sale_date)||'-'||lpad(date_part('month',sv.sale_date)::text,2,'0')
            // group by x.d2
            // order by x.d2`

            query = `
            select x.dt as bill_dt, sum(s.digi_amount) as digital, sum(s.cash_amount) as cash, 
            sum(s.total) as total, count(s.bill_no) as orders 
            from sale s inner join 
            (select months('${fromdate}','${todate}') as dt)x on x.dt::text = date_part('year',s.bill_date)||'-'||lpad(date_part('month',s.bill_date)::text,2,'0')
            and s.status = 'COMPLETE'
            group by x.dt
            order by x.dt;`
        }
        return await this.manager.query(query);
    }

    async getCustomerVisitByFreq(fromdate:string,freq:string,count:number){
   
        const dt = new Date(fromdate);
        let query = ''

        if(freq === 'daily'){
            const date = new Date(dt.setDate(dt.getDate()+1));
            const other = date.setDate(date.getDate()-count);
            const todate = this.getFormatDate(new Date(other));
            query = `select to_char(x.dt,'yyyy-mm-dd') as date, scv.return_status, count(scv.recent_sale_id)
             from (select date(generate_series('${todate}'::date,'${fromdate}','1 day')) as dt)x 
             left join sale_customer_view scv on x.dt = scv.recent_visit
             where scv.mobile != '00000'
             group by x.dt, scv.return_status 
              order by x.dt`
        }
        else {
            const date = new Date();
            const other = date.setMonth((date.getMonth()-1)-count);
            const todate = this.getFormatDate(new Date(other));
            query = `select x.dt as date, scv.return_status, count(scv.recent_sale_id)
            from (select months('${fromdate}','${todate}')::text as dt) x
            left join sale_customer_view scv on x.dt = date_part('year',scv.recent_visit::date)||'-'||lpad(date_part('month',scv.recent_visit::date)::text,2,'0')
            where scv.mobile != '00000'
            group by x.dt, scv.return_status 
             order by x.dt`
        }
        return await this.manager.query(query);
    }

    async findAllByCustomerId(custid,limit){
        const saleids = await this.manager.query(`
        select s.id
        from sale s where s.status = 'COMPLETE' and s.customer_id = ${custid} order by s.bill_date desc limit ${limit}`);
        const ids = saleids.map(i => i.id);
        
        if(ids.length == 0)
            return []
        
        return await this.saleRepository.createQueryBuilder("sale")
		  	.innerJoinAndSelect("sale.customer", "customer")
	          .leftJoinAndSelect("sale.items", "items")
	          .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
	          .leftJoinAndSelect("purchaseitem.product", "product")
	            .select(['sale','customer','items','purchaseitem','product'])
          .where(`sale.status = 'COMPLETE' and items.status = 'Complete' and sale.id in (${ids.join(',')})`)
          .orderBy(`sale.billdate`,'DESC')
          .getMany();
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
                sri.qty, si.price, sri.reason, sri."comments", sri.status 
                from sale_return_item sri inner join sale_item si on si.id = sri.sale_item_id 
                inner join sale s on s.id = si.sale_id 
                inner join product p on p.id = si.product_id 
                left join customer c on c.id = s.customer_id 
                order by sri.created_on desc`);
    }

    async getEligibleReturns(saleid:any){
        return await this.manager.query(`   
            select si.id, p.title, si.batch, si.exp_date, si.price, coalesce(si.qty - returned.total,si.qty - returned.total,si.qty) as eligible
            from sale_item si left join 
            (SELECT sale_item_id, sum(sri.qty) as total FROM sale_return_item sri 
            inner join sale_item si on si.id = sri.sale_item_id WHERE si.sale_id = ${saleid} GROUP BY sale_item_id) returned ON returned.sale_item_id = si.id 
            inner join sale s on s.id = si.sale_id and s.id = ${saleid}
            inner join product p on p.id = si.product_id order by p.title`);
    }

    async getReturnItemToAdjust(saleReturnId:any){
        return await this.manager.query(`
        select sri.id, p.title, si.batch, si.exp_date, si.price, si.purchase_item_id as itemid, sri.qty, sri.reason, sri."comments"
        from sale_return_item sri 
        inner join sale_item si on si.id = sri.sale_item_id 
        inner join product p on p.id = si.product_id 
        where sri.id = ${saleReturnId}`);
    }

    async findById(id:number){
        return await this.saleRepository.createQueryBuilder("sale")
        .leftJoinAndSelect("sale.customer", "customer")
        .leftJoinAndSelect("sale.items", "items")
        .leftJoinAndSelect("items.product", "product")
          .select(['sale','customer','items','product'])
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
        (select sale_id as sid, purchase_item_id as pid, sum(qty) as net from sale_item si where sale_id = ${id}
        group by sale_id, purchase_item_id) x on x.sid = s.sale_id and x.pid = s.purchase_item_id and x.net > 0 and status is null
        inner join purchase_invoice_item pii on pii.id = s.purchase_item_id 
        inner join product p on p.id = pii.product_id`);
    }

    async update(id:any, values:any, userid:any){
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.saleRepository.findOne({id});
            await transaction.update(Sale, id, {...obj, ...values, updatedby:userid});
        });
    } 

    async delete(id:any){
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.delete(Sale, id);
        });
    } 
    
    async removeItem(itemid:any, userid:any){
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
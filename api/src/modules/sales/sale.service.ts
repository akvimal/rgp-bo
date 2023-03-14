import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { SaleItem } from "src/entities/sale-item.entity";
import { Sale } from "src/entities/sale.entity";
import { Repository } from "typeorm";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";

@Injectable()
export class SaleService {

    constructor(@InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem) private readonly saleItemRepository: Repository<SaleItem>,
    @InjectEntityManager() private manager: EntityManager) { }

    async create(sale:any,userid:any) {
        return this.saleRepository.save({...sale, createdby:userid}).then(data => {
            // console.log('data: ',data);
            data.items.forEach(i => {
                i.saleid = data.id;
            })
            return this.saleItemRepository.save(data.items).then(d => {
                return new Promise(async (resolve,reject)=>{
                    const sale = await this.findById(data.id)
                    // console.log('data:',data);
                    resolve(sale);
                })
            })
            
            
        });
    }

    async removeItems(createSaleDto:CreateSaleDto){
        return await this.saleItemRepository.delete({saleid:createSaleDto.id});
    }    
    // async updateItems(createSaleDto:CreateSaleDto, userid:any){
    //     await this.saleItemRepository.delete({saleid:createSaleDto.id});
    //     return await this.saleRepository.save({...createSaleDto, updatedby:userid});
    // }    
  
    async createItem(createSaleItemDto: CreateSaleItemDto, userid:any) {
        return this.saleItemRepository.save({...createSaleItemDto, createdby:userid});
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
            qb.andWhere(`DATE_TRUNC('day', sale.createdon) = :con`, { con:query.date });
        }
        if(query.customer){
            qb.andWhere(`customer.id = :cid`, { cid:query.customer });
        }
        if(query.status){
            qb.andWhere(`sale.status = :st`, { st:query.status });
        }
        qb.orderBy('sale.createdon','DESC')
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
        if(query.category){
            qb.andWhere('product.category = :ctg', { ctg:query.category });
        }        
        if(query.fromdate && query.todate){
            qb.andWhere('sale.billdate >= :from and sale.billdate <= :to', { from:query.fromdate,to:query.todate });
        }
        if(userid){
            qb.andWhere('sale.createdby = :uid', { uid:userid });
        }
        
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

    async getSalesByFreq(fromdate:string,freq:string,count:number){
        console.log(fromdate);
        const dt = new Date(fromdate)
        const date = new Date(dt.setDate(dt.getDate()+1));
        // const fromdtstr = this.getFormatDate(date);
        const other = date.setDate(date.getDate()-count);
        const todate = this.getFormatDate(new Date(other));
        
        let freqstr = freq === 'daily' ? '1 day' : '1 month'

        
        const data = await this.manager.query(`select to_char(x.dt,'yyyy-mm-dd') as date, 
        sum(sv.sale_total) as sale
        from (select date(generate_series('${todate}'::date,'${fromdate}','${freqstr}')) as dt)x 
        left join sale_view sv on x.dt = sv.sale_date 
        group by x.dt order by x.dt`);
        return data;
    }

    async findAllByCustomerId(custid,limit){
        const saleids = await this.manager.query(`
        select s.id
        from sale s where s.status = 'COMPLETE' and s.customer_id = ${custid} order by s.bill_date desc limit ${limit}`);
        const ids = saleids.map(i => i.id);
        
        return await this.saleRepository.createQueryBuilder("sale")
		  	.innerJoinAndSelect("sale.customer", "customer")
	          .leftJoinAndSelect("sale.items", "items")
	          .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
	          .leftJoinAndSelect("purchaseitem.product", "product")
	            .select(['sale','customer','items','purchaseitem','product'])
          .where(`sale.status = 'COMPLETE' and sale.id in (${ids.join(',')})`)
          .getMany();
    }

    async getSales(){
        return await this.manager.query(`   
        select s.id, s.bill_date, s.status , s.customer_id, c.name, c.mobile, ss.itemcount, ss.total 
        from sale s inner join 
        (select sale_id, count(*) as itemcount, sum(qty * price) as total from sale_item group by sale_id) ss on ss.sale_id = s.id
        inner join customer c on c.id = s.customer_id `);
    }

    async findById(id:string){
        return await this.saleRepository.createQueryBuilder("sale")
        .leftJoinAndSelect("sale.customer", "customer")
        .leftJoinAndSelect("sale.items", "items")
        .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
        .leftJoinAndSelect("purchaseitem.product", "product")
          .select(['sale','customer','items','purchaseitem','product'])
          .where('sale.id = :id', { id })
          .getOne();
    }

    async findAllItemsBySale(id:string){
        return this.saleItemRepository.createQueryBuilder('si')
            .where('si.saleid = :id', { id })
            .getMany();
    }

    async update(id:any, values:any, userid:any){
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.saleRepository.findOne({id});
            await transaction.update(Sale, id, {...obj, ...values, updatedby:userid});
        });
    } 
    
    async removeItem(itemid:any, userid:any){
        await this.saleItemRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.update(SaleItem, itemid, {isArchived:true, updatedby:userid});
        });
    }    

}
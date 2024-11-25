import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { Customer } from "src/entities/customer.entity";
import { Sale } from "src/entities/sale.entity";
import { EntityManager, Repository } from "typeorm";
import { CreateCustomerDto } from "./dto/create-customer.dto";

@Injectable()
export class CustomerService {

    constructor(@InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectEntityManager() private manager: EntityManager) { }

    async save(createCustomerDto: CreateCustomerDto) {
        return this.customerRepository.save(createCustomerDto);
      }
    
    async findAll(){
        return this.customerRepository.createQueryBuilder('c')
            .where('c.active = :flag', { flag: true }).getMany();
    }
    
    async findById(id:string) {
        return this.customerRepository.findOne(id);
    }

    async findSaleData(criteria:any) {
        const query = `select * from customer_sale_view`;
        return await this.manager.query(query);
    }

    async filterByCriteria(criteria:any) {

        const qb = this.customerRepository.createQueryBuilder('c')
            .where('c.active = :flag', { flag: true });
            let ch = '';
            for(let index = 0; index < criteria.criteria.length; index++) {
                const c = criteria.criteria[index];
                if(c['check'] === 'startswith'){
                    ch += `${c.property} ilike '${c.value}%'`
                }
                
                if(index < (criteria.criteria.length-1))
                    ch +=  criteria.condition === 'any' ? ' or ' : ' and '
            }
    
            qb.andWhere(ch);
            if(criteria.limit)
                qb.limit(criteria.limit);
        return qb.getMany();
    }

    async update(id:any, values:any){
        await this.customerRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.customerRepository.findOne({id});
            await transaction.update(Customer, id, {...obj, ...values});
        });
      }

      async findSalePeriods(custid){
        return await this.manager.query(`
        select x.yr, x.mon, sum(x.total) as total, count(*) from
            (select date_part('year',s.bill_date) as yr, date_part('month',s.bill_date) as mon, s.id, s.total
                from sale s 
                where s.status = 'COMPLETE' and s.customer_id = ${custid} and s.bill_date between (current_date - 365) and current_date) x 
        group by x.yr, x.mon order by x.yr desc, x.mon desc`);
    }

    async findDocuments(custid){
        return await this.manager.query(`
        select d.* from customer_documents cd inner join documents d on d.id = cd.document_id where cd.customer_id = ${custid} order by d.created_on desc`);
    }

    async addDocument(custId:number,docId:number){
        return await this.manager.query(`insert into customer_documents (customer_id,document_id) values (${custId},${docId})`);
    }

    async removeDocument(custId:number,docId:number){
        await this.manager.query(`delete from documents where id = ${docId}`)
        return await this.manager.query(`delete from customer_documents where customer_id = ${custId}`);
    }

    async findCustomerSaleByPeriod(custid,year,month){

        let day = 31;
        if(month == 2)
          day = year%4 == 0 ? 29 : 28;
        if(month <= 6 && month != 2 && month%2 == 0)
          day = 30;
        if(month > 8 && month%2 == 1)
          day = 30;
        
          return await this.saleRepository.createQueryBuilder("sale")
                .innerJoinAndSelect("sale.customer", "customer")
                .leftJoinAndSelect("sale.items", "items")
                .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
                .leftJoinAndSelect("purchaseitem.product", "product")
                  .select(['sale','customer','items','purchaseitem','product'])
            .where(`sale.status = 'COMPLETE' and items.status = 'Complete' and sale.customer_id = ${custid}
             and sale.bill_date between '${year}-${month}-01' and '${year}-${month}-${day}'`)
            .orderBy(`sale.billdate`,'DESC')
            .getMany();
      }
}
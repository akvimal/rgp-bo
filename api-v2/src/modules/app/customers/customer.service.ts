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
    
    async findById(id:number) {
        return this.customerRepository.findOne({where:{id}});
    }

    async findByMobile(mobile:string) {
        return this.customerRepository.createQueryBuilder('c')
            .where('c.mobile = :mobile', { mobile }).getOne();
    }

    // async findSaleData(criteria:any) {
    //     const query = `select * from customer_sale_view`;
    //     return await this.manager.query(query);
    // }

    async filterByCriteria(criteria:any) {

        const qb = this.customerRepository.createQueryBuilder('c')
            .where('c.active = :flag', { flag: true });

            const conditions:string[] = [];
            const params:any = {};

            for(let index = 0; index < criteria.criteria.length; index++) {
                const c = criteria.criteria[index];
                const paramName = `param${index}`;

                if(c['check'] === 'startswith'){
                    // Only allow whitelisted properties to prevent column injection
                    const allowedProps = ['name', 'mobile', 'email', 'address'];
                    if(!allowedProps.includes(c.property)){
                        throw new Error(`Invalid property: ${c.property}`);
                    }
                    conditions.push(`c.${c.property} ilike :${paramName}`);
                    params[paramName] = `${c.value}%`;
                }
            }

            if(conditions.length > 0){
                const whereClause = conditions.join(criteria.condition === 'any' ? ' or ' : ' and ');
                qb.andWhere(whereClause, params);
            }

            if(criteria.limit)
                qb.limit(criteria.limit);
        return qb.getMany();
    }

    async update(id:any, values:any){
        await this.customerRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.customerRepository.findOne({where:{id}});
            await transaction.update(Customer, id, {...obj, ...values});
        });
      }

      async findSalePeriods(custid){
        const days = 3 * 365; //3yrs
        return await this.manager.query(`
        select x.yr, x.mon, sum(x.total) as total, count(*) from
            (select date_part('year',s.bill_date) as yr, date_part('month',s.bill_date) as mon, s.id, s.total
                from sale s
                where s.status = 'COMPLETE' and s.customer_id = $1 and s.bill_date between (current_date - $2) and current_date) x
        group by x.yr, x.mon order by x.yr desc, x.mon desc`, [custid, days]);
    }

    async findDocuments(custid){
        return await this.manager.query(`
        select d.* from customer_documents cd inner join documents d on d.id = cd.document_id where cd.customer_id = $1 order by d.created_on desc`, [custid]);
    }

    async addDocument(cdoc){
        return await this.manager.query(`insert into customer_documents (customer_id,document_id) values ($1,$2)`, [cdoc.customerId, cdoc.documentId]);
    }

    async removeDocument(custId:number,ids:number[]){
        if (!ids || ids.length === 0) return;
        const placeholders = ids.map((_, index) => `$${index + 2}`).join(',');
        await this.manager.query(`delete from customer_documents where customer_id = $1 and document_id in (${placeholders})`, [custId, ...ids]);

        const placeholders2 = ids.map((_, index) => `$${index + 1}`).join(',');
        return await this.manager.query(`delete from documents where id in (${placeholders2})`, ids)
    }

    async findCustomerSaleByPeriod(custid,year,month){

        let day = 31;
        if(month == 2)
          day = year%4 == 0 ? 29 : 28;
        if(month <= 6 && month != 2 && month%2 == 0)
          day = 30;
        if(month > 8 && month%2 == 1)
          day = 30;

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          return await this.saleRepository.createQueryBuilder("sale")
                .innerJoinAndSelect("sale.customer", "customer")
                .leftJoinAndSelect("sale.items", "items")
                .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
                .leftJoinAndSelect("purchaseitem.product", "product")
                  .select(['sale','customer','items','purchaseitem','product'])
            .where(`sale.status = 'COMPLETE' and items.status = 'Complete' and sale.customer_id = :custid
             and sale.bill_date between :startDate and :endDate`, { custid, startDate, endDate })
            .orderBy(`sale.billdate`,'DESC')
            .getMany();
      }
}
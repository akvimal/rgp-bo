import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { Customer } from "src/entities/customer.entity";
import { EntityManager, Repository } from "typeorm";
import { CreateCustomerDto } from "./dto/create-customer.dto";

@Injectable()
export class CustomerService {

    constructor(@InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
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
}
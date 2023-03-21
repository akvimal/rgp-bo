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

    async update(id:any, values:any){
        await this.customerRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.customerRepository.findOne({id});
            await transaction.update(Customer, id, {...obj, ...values});
        });
      }
}
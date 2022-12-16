import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Customer } from "src/entities/customer.entity";
import { Repository } from "typeorm";
import { CreateCustomerDto } from "./dto/create-customer.dto";

@Injectable()
export class CustomerService {

    constructor(@InjectRepository(Customer) private readonly customerRepository: Repository<Customer>) { }

    async create(createCustomerDto: CreateCustomerDto) {
        return this.customerRepository.save(createCustomerDto);
      }
    
    async findAll(){
        return this.customerRepository.createQueryBuilder('c')
            .where('c.active = :flag', { flag: true }).getMany();
    }

    async update(id:any, values:any){
        await this.customerRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.customerRepository.findOne({id});
            await transaction.update(Customer, id, {...obj, ...values});
        });
      }
}
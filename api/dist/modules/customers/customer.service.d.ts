import { Customer } from "src/entities/customer.entity";
import { Repository } from "typeorm";
import { CreateCustomerDto } from "./dto/create-customer.dto";
export declare class CustomerService {
    private readonly customerRepository;
    constructor(customerRepository: Repository<Customer>);
    create(createCustomerDto: CreateCustomerDto): Promise<CreateCustomerDto & Customer>;
    findAll(): Promise<Customer[]>;
    update(id: any, values: any): Promise<void>;
}

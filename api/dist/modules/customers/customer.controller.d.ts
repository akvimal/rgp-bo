import { CustomerService } from "./customer.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
export declare class CustomerController {
    private customerService;
    constructor(customerService: CustomerService);
    create(createCustomerDto: CreateCustomerDto): Promise<CreateCustomerDto & import("../../entities/customer.entity").Customer>;
    findAll(): Promise<import("../../entities/customer.entity").Customer[]>;
    remove(id: string): Promise<void>;
}

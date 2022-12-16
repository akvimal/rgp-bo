import { AppUser } from "./AppUser.entity";
import { BaseEntity } from "./base.entity";
import { Customer } from "./customer.entity";
import { SaleItem } from "./sale-item.entity";
export declare class Sale extends BaseEntity {
    id: number;
    billdate: Date;
    customerid: number;
    status: string | null;
    paymode: string | null;
    payrefno: string | null;
    total: number;
    props: object | null;
    customer: Customer;
    created: AppUser;
    items: SaleItem[];
}

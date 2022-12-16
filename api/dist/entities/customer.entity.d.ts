import { BaseEntity } from "./base.entity";
import { Sale } from "./sale.entity";
export declare class Customer extends BaseEntity {
    id: number;
    name: string | null;
    mobile: string | null;
    email: string | null;
    location: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    srctype: string | null;
    srcdesc: string | null;
    sales: Sale[];
}

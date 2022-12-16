import { BaseEntity } from "./base.entity";
import { PurchaseInvoice } from "./purchase-invoice.entity";
export declare class Vendor extends BaseEntity {
    id: number;
    name: string;
    contactname: string;
    contactphone: string;
    address: string;
    gstn: string;
    comments: string;
    props: object | null;
    purchaseInvoices: PurchaseInvoice[];
}

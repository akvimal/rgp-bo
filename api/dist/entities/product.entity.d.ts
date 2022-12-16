import { BaseEntity } from "./base.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
export declare class Product extends BaseEntity {
    id: number;
    title: string;
    code: string;
    hsn: string;
    mfr: string;
    brand: string;
    category: string;
    description: string;
    props: object | null;
    purchaseInvoiceItems: PurchaseInvoiceItem[];
}

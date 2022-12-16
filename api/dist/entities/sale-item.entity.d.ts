import { BaseEntity } from "./base.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { Sale } from "./sale.entity";
export declare class SaleItem extends BaseEntity {
    id: number;
    saleid: number;
    itemid: number;
    price: number;
    qty: number;
    total: number;
    status: string | null;
    comments: string | null;
    purchaseitem: PurchaseInvoiceItem;
    sale: Sale;
}

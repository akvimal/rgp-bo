import { PurchaseInvoice } from "./purchase-invoice.entity";
import { Product } from "./product.entity";
import { BaseEntity } from "./base.entity";
import { SaleItem } from "./sale-item.entity";
export declare class PurchaseInvoiceItem extends BaseEntity {
    id: number;
    invoiceid: number;
    productid: number;
    batch: string | null;
    expdate: string | null;
    ptrcost: number;
    mrpcost: number;
    taxpcnt: number | null;
    saleprice: number | null;
    qty: number;
    total: number;
    comments: string | null;
    status: string;
    invoice: PurchaseInvoice;
    product: Product;
    saleitems: SaleItem[];
}

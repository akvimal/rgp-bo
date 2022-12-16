import { BaseEntity } from "./base.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { Vendor } from "./vendor.entity";
export declare class PurchaseInvoice extends BaseEntity {
    id: number;
    invoiceno: string;
    invoicedate: string;
    status: string;
    grn: string;
    total: number;
    comments: string;
    vendorid: number;
    purchaseorderid: string;
    paydate: string;
    paymode: string;
    payrefno: string;
    paycomments: string;
    payamount: number;
    vendor: Vendor;
    items: PurchaseInvoiceItem[];
}

export declare class CreatePurchaseInvoiceDto {
    readonly id: number;
    readonly invoiceno: string;
    readonly invoicedate: string;
    readonly status: string;
    readonly grn: string;
    readonly total: number;
    readonly vendorid: number;
    readonly purchaseorderid: string;
    readonly items: [];
}

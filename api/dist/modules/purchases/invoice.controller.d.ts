import { PurchaseInvoiceService } from "./invoice.service";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoicesDto } from "./dto/update-invoices.dto";
export declare class PurchaseInvoiceController {
    private purchaseInvoiceService;
    constructor(purchaseInvoiceService: PurchaseInvoiceService);
    findAll(): Promise<import("../../entities/purchase-invoice.entity").PurchaseInvoice[]>;
    findById(id: string): Promise<import("../../entities/purchase-invoice.entity").PurchaseInvoice>;
    create(dto: CreatePurchaseInvoiceDto, currentUser: any): Promise<import("typeorm").UpdateResult | ({
        createdby: any;
        id: number;
        invoiceno: string;
        invoicedate: string;
        status: string;
        grn: string;
        total: number;
        vendorid: number;
        purchaseorderid: string;
        items: [];
    } & import("../../entities/purchase-invoice.entity").PurchaseInvoice)>;
    updateItems(input: UpdateInvoicesDto, currentUser: any): Promise<import("typeorm").UpdateResult>;
    remove(id: any, currentUser: any): Promise<import("typeorm").UpdateResult>;
}

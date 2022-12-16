import { PurchaseInvoiceService } from "./invoice.service";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { UpdateInvoiceItemsDto } from "./dto/update-invoice-items.dto";
export declare class PurchaseItemController {
    private purchaseInvoiceService;
    constructor(purchaseInvoiceService: PurchaseInvoiceService);
    findAllItems(status: any): Promise<import("../../entities/purchase-invoice-item.entity").PurchaseInvoiceItem[]>;
    findItemById(id: string): Promise<import("../../entities/purchase-invoice-item.entity").PurchaseInvoiceItem>;
    createItem(createPurchaseInvoiceItemDto: CreatePurchaseInvoiceItemDto, currentUser: any): Promise<void>;
    updateItems(input: UpdateInvoiceItemsDto, currentUser: any): Promise<import("typeorm").UpdateResult>;
    remove(input: {
        invoiceid: number;
        ids: number[];
    }, currentUser: any): Promise<void>;
}

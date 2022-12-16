import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Repository } from "typeorm";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
export declare class PurchaseInvoiceService {
    private readonly purchaseInvoiceRepository;
    private readonly purchaseInvoiceItemRepository;
    constructor(purchaseInvoiceRepository: Repository<PurchaseInvoice>, purchaseInvoiceItemRepository: Repository<PurchaseInvoiceItem>);
    create(dto: CreatePurchaseInvoiceDto, userid: any): Promise<{
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
    } & PurchaseInvoice>;
    createItem(dto: CreatePurchaseInvoiceItemDto, userid: any): Promise<{
        createdby: any;
        invoiceid: number;
        productid: number;
        batch: string;
        expdate: string;
        ptrcost: number;
        mrpcost: number;
        taxpcnt: number;
        saleprice: number;
        qty: number;
        total: number;
        comments: string;
        status: string;
    } & PurchaseInvoiceItem>;
    findAll(): Promise<PurchaseInvoice[]>;
    findById(id: string): Promise<PurchaseInvoice>;
    findItemById(id: string): Promise<PurchaseInvoiceItem>;
    findAllItemsByInvoice(id: number): Promise<PurchaseInvoiceItem[]>;
    findAllItems(criteria: any): Promise<PurchaseInvoiceItem[]>;
    update(ids: number[], values: any, userid: number): Promise<import("typeorm").UpdateResult>;
    updateItems(ids: number[], values: any, userid: any): Promise<import("typeorm").UpdateResult>;
    removeItems(ids: number[]): Promise<import("typeorm").DeleteResult>;
}

import { EntityManager } from "typeorm";
import { SaleItem } from "src/entities/sale-item.entity";
import { Sale } from "src/entities/sale.entity";
import { Repository } from "typeorm";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
export declare class SaleService {
    private readonly saleRepository;
    private readonly saleItemRepository;
    private manager;
    constructor(saleRepository: Repository<Sale>, saleItemRepository: Repository<SaleItem>, manager: EntityManager);
    create(sale: any, userid: any): Promise<unknown>;
    removeItems(createSaleDto: CreateSaleDto): Promise<import("typeorm").DeleteResult>;
    createItem(createSaleItemDto: CreateSaleItemDto, userid: any): Promise<{
        createdby: any;
        saleid: number;
        itemid: number;
        price: number;
        qty: number;
        status: string;
        comments: string;
    } & SaleItem>;
    findAll(query: any, userid: any): Promise<Sale[]>;
    findAllItems(query: any, userid: any): Promise<SaleItem[]>;
    findAllByCustomerId(custid: any, limit: any): Promise<Sale[]>;
    getSales(): Promise<any>;
    findById(id: string): Promise<Sale>;
    findAllItemsBySale(id: string): Promise<SaleItem[]>;
    update(id: any, values: any, userid: any): Promise<void>;
    removeItem(itemid: any, userid: any): Promise<void>;
}

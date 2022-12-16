import { SaleService } from "./sale.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { CustomerService } from "../customers/customer.service";
import { StockService } from "../inventory/stock.service";
import { RoleService } from "../app/roles/role.service";
export declare class SaleController {
    private saleService;
    private stockService;
    private custService;
    private roleService;
    constructor(saleService: SaleService, stockService: StockService, custService: CustomerService, roleService: RoleService);
    create(createSaleDto: CreateSaleDto, currentUser: any): Promise<unknown>;
    createItem(createSaleItemDto: CreateSaleItemDto, currentUser: any): Promise<{
        createdby: any;
        saleid: number;
        itemid: number;
        price: number;
        qty: number;
        status: string;
        comments: string;
    } & import("../../entities/sale-item.entity").SaleItem>;
    findAllSales(): Promise<any>;
    findAll(query: any, currentUser: any): Promise<import("../../entities/sale.entity").Sale[]>;
    findAllItems(criteria: any, currentUser: any): Promise<import("../../entities/sale-item.entity").SaleItem[]>;
    findById(id: string): Promise<{
        items: any[];
        id: number;
        billdate: Date;
        customerid: number;
        status: string;
        paymode: string;
        payrefno: string;
        total: number;
        props: object;
        customer: import("../../entities/customer.entity").Customer;
        created: import("../../entities/AppUser.entity").AppUser;
        isActive: boolean;
        isArchived: boolean;
        createdon: Date;
        createdby: number;
        updatedon: Date;
        updatedby: number;
    }>;
    findItems(custid: string): Promise<import("../../entities/sale.entity").Sale[]>;
    findAllItemsBySale(id: string): Promise<import("../../entities/sale-item.entity").SaleItem[]>;
    remove(id: string, currentUser: any): Promise<void>;
    removeItem(id: string, currentUser: any): Promise<void>;
}

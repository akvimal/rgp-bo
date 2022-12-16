import { ProductService } from "./product.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { PurchaseInvoiceService } from "../purchases/invoice.service";
export declare class ProductController {
    private productService;
    private invoiceService;
    constructor(productService: ProductService, invoiceService: PurchaseInvoiceService);
    create(createDto: CreateProductDto, currentUser: any): Promise<{
        createdby: any;
        title: string;
        description: string;
        code: string;
        hsn: string;
        mfr: string;
        brand: string;
        category: string;
        props: object;
    } & import("../../entities/product.entity").Product>;
    createPrice(createDto: CreateProductPriceDto, currentUser: any): Promise<{
        createdby: any;
        itemid: number;
        effdate: string;
        price: number;
        comments: string;
    } & import("../../entities/product-price.entity").ProductPrice>;
    update(id: string, updateDto: UpdateProductDto, currentUser: any): Promise<import("typeorm").UpdateResult>;
    findAll(query: any, currentUser: any): Promise<import("../../entities/product.entity").Product[]>;
    findOne(id: string): Promise<import("../../entities/product.entity").Product>;
    remove(id: string, currentUser: any): Promise<import("typeorm").UpdateResult>;
}

import { ProductPrice } from "src/entities/product-price.entity";
import { Product } from "src/entities/product.entity";
import { Repository } from "typeorm";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductDto } from "./dto/create-product.dto";
export declare class ProductService {
    private readonly productRepository;
    private readonly priceRepository;
    constructor(productRepository: Repository<Product>, priceRepository: Repository<ProductPrice>);
    create(createProductDto: CreateProductDto, userid: any): Promise<{
        createdby: any;
        title: string;
        description: string;
        code: string;
        hsn: string;
        mfr: string;
        brand: string;
        category: string;
        props: object;
    } & Product>;
    createPrice(dto: CreateProductPriceDto, userid: any): Promise<{
        createdby: any;
        itemid: number;
        effdate: string;
        price: number;
        comments: string;
    } & ProductPrice>;
    findAll(query: any, user: any): Promise<Product[]>;
    findAllPriceByItem(id: number): Promise<ProductPrice[]>;
    findById(id: string): Promise<Product>;
    update(id: any, values: any, userid: any): Promise<import("typeorm").UpdateResult>;
    updatePrice(id: any, values: any, userid: any): Promise<import("typeorm").UpdateResult>;
}

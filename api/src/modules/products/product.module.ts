import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductPrice } from "src/entities/product-price.entity";

import { Product } from "src/entities/product.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceService } from "../purchases/invoice.service";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";

@Module({
    imports: [TypeOrmModule.forFeature([Product,ProductPrice,PurchaseInvoice,PurchaseInvoiceItem])],
    controllers: [ProductController],
    providers: [ProductService,PurchaseInvoiceService],
    exports: [ProductService,PurchaseInvoiceService],
  })
  export class ProductModule {}
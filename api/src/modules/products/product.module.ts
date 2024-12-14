import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductPrice2 } from "../../entities/product-price2.entity";

import { Product } from "../../entities/product.entity";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";

@Module({
    imports: [TypeOrmModule.forFeature([Product, ProductPrice2])],
    controllers: [ProductController],
    providers: [ProductService],
    exports: [ProductService],
  })
  export class ProductModule {}
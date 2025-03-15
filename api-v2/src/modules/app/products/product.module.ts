import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
@Module({
    imports: [TypeOrmModule.forFeature([Product, ProductPrice2]),AuthModule],
    controllers: [ProductController],
    providers: [ProductService,JwtService],
    exports: [ProductService],
  })
  export class ProductModule {}
import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { PricingCalculatorService } from "./pricing-calculator.service";
import { PricingRulesService } from "./pricing-rules.service";
import { ProductOcrService } from "./product-ocr.service";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { HsnTaxMaster } from "src/entities/hsn-tax-master.entity";
import { PricingRule } from "src/entities/pricing-rule.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
@Module({
    imports: [TypeOrmModule.forFeature([Product, ProductPrice2, HsnTaxMaster, PricingRule]),AuthModule],
    controllers: [ProductController],
    providers: [ProductService, PricingCalculatorService, PricingRulesService, ProductOcrService, JwtService],
    exports: [ProductService, PricingCalculatorService, PricingRulesService, ProductOcrService],
  })
  export class ProductModule {}
import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductController } from "./product.controller";
import { ProductAnalyticsController } from "./product-analytics.controller";
import { ProductService } from "./product.service";
import { ProductAnalyticsService } from "./product-analytics.service";
import { PricingCalculatorService } from "./pricing-calculator.service";
import { PricingRulesService } from "./pricing-rules.service";
import { ProductOcrService } from "./product-ocr.service";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { ProductBatch } from "src/entities/product-batch.entity";
import { SaleItem } from "src/entities/sale-item.entity";
import { HsnTaxMaster } from "src/entities/hsn-tax-master.entity";
import { PricingRule } from "src/entities/pricing-rule.entity";
import { PricingRuleApplication } from "src/entities/pricing-rule-application.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
@Module({
    imports: [TypeOrmModule.forFeature([Product, ProductPrice2, ProductBatch, SaleItem, HsnTaxMaster, PricingRule, PricingRuleApplication]),AuthModule],
    controllers: [ProductController, ProductAnalyticsController],
    providers: [ProductService, ProductAnalyticsService, PricingCalculatorService, PricingRulesService, ProductOcrService, JwtService],
    exports: [ProductService, ProductAnalyticsService, PricingCalculatorService, PricingRulesService, ProductOcrService],
  })
  export class ProductModule {}
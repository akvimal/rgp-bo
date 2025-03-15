import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from "../customers/customer.service";
import { StockService } from "../stock/stock.service";
import { SaleDeliveryController } from "./sale-delivery.controller";
import { SaleDeliveryService } from "./sale-delivery.service";

import { SaleController } from "./sale.controller";
import { SaleService } from "./sale.service";
import { SaleItem } from "src/entities/sale-item.entity";
import { Sale } from "src/entities/sale.entity";
import { SaleDelivery } from "src/entities/sale-delivery.entity";
import { SaleReturnItem } from "src/entities/salereturn-item.entity";
import { Customer } from "src/entities/customer.entity";
import { AppRole } from "src/entities/approle.entity";
import { RoleService } from "../roles/role.service";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";

@Module({
    imports: [TypeOrmModule.forFeature([Sale,SaleItem,SaleDelivery,SaleReturnItem,Customer,AppRole,ProductPriceChange,ProductQtyChange]),AuthModule],
    controllers: [SaleController,SaleDeliveryController],
    providers: [SaleService,SaleDeliveryService,CustomerService,RoleService,StockService,JwtService],
    exports: [SaleService,SaleDeliveryService],
  })
  export class SaleModule {}
import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from "src/entities/approle.entity";
import { Customer } from "src/entities/customer.entity";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { SaleDelivery } from "src/entities/sale-delivery.entity";
import { SaleItem } from "src/entities/sale-item.entity";
import { Sale } from "src/entities/sale.entity";
import { SaleReturnItem } from "src/entities/salereturn-item.entity";
import { RoleService } from "../app/roles/role.service";
import { CustomerService } from "../customers/customer.service";
import { StockService } from "../stock/stock.service";
import { SaleDeliveryController } from "./sale-delivery.controller";
import { SaleDeliveryService } from "./sale-delivery.service";

import { SaleController } from "./sale.controller";
import { SaleService } from "./sale.service";

@Module({
    imports: [TypeOrmModule.forFeature([Sale,SaleItem,SaleDelivery,SaleReturnItem,Customer,AppRole,ProductPriceChange,ProductQtyChange])],
    controllers: [SaleController,SaleDeliveryController],
    providers: [SaleService,SaleDeliveryService,CustomerService,RoleService,StockService],
    exports: [SaleService,SaleDeliveryService],
  })
  export class SaleModule {}
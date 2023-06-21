import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from "src/entities/approle.entity";
import { Customer } from "src/entities/customer.entity";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { SaleItem } from "src/entities/sale-item.entity";
import { SaleReturnItem } from "src/entities/salereturn-item.entity";
import { Sale } from "src/entities/sale.entity";
import { RoleService } from "../app/roles/role.service";
import { CustomerService } from "../customers/customer.service";
import { StockService } from "../stock/stock.service";

import { SaleReturnController } from "./salereturn.controller";
import { SaleItemService } from "./saleitem.service";

@Module({
    imports: [TypeOrmModule.forFeature([Sale,SaleItem,SaleReturnItem,Customer,AppRole,ProductPriceChange,ProductQtyChange])],
    controllers: [SaleReturnController],
    providers: [SaleItemService,CustomerService,RoleService,StockService],
    exports: [],
  })
  export class SaleReturnModule {}
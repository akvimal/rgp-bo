import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from "../customers/customer.service";
import { StockModule } from "../stock/stock.module";

import { SaleReturnController } from "./salereturn.controller";
import { SaleItemService } from "./saleitem.service";
import { SaleItem } from "src/entities/sale-item.entity";
import { Sale } from "src/entities/sale.entity";
import { AppRole } from "src/entities/approle.entity";
import { Customer } from "src/entities/customer.entity";
import { SaleReturnItem } from "src/entities/salereturn-item.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { ProductClearance } from "src/entities/product-clearance.entity";
import { ProductBatch } from "src/entities/product-batch.entity";
import { BatchMovementLog } from "src/entities/batch-movement-log.entity";
import { RoleService } from "../roles/role.service";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
@Module({
    imports: [
      TypeOrmModule.forFeature([
        Sale,
        SaleItem,
        SaleReturnItem,
        Customer,
        AppRole,
        PurchaseInvoiceItem,
        ProductClearance,
        ProductBatch,
        BatchMovementLog
      ]),
      StockModule,
      AuthModule
    ],
    controllers: [SaleReturnController],
    providers: [SaleItemService, CustomerService, RoleService, JwtService],
    exports: [SaleItemService],
  })
  export class SaleReturnModule {}
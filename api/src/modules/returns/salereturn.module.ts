import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from "../../entities/approle.entity";
import { Customer } from "../../entities/customer.entity";
import { SaleItem } from "../../entities/sale-item.entity";
import { SaleReturnItem } from "../../entities/salereturn-item.entity";
import { Sale } from "../../entities/sale.entity";
import { RoleService } from "../app/roles/role.service";
import { CustomerService } from "../customers/customer.service";

import { SaleReturnController } from "./salereturn.controller";
import { SaleItemService } from "./saleitem.service";
import { ProductClearance } from "../../entities/product-clearance.entity";
import { PurchaseInvoiceItem } from "../../entities/purchase-invoice-item.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Sale,SaleItem,
      SaleReturnItem,Customer,AppRole,
      PurchaseInvoiceItem,
      ProductClearance])],
    controllers: [SaleReturnController],
    providers: [SaleItemService,CustomerService,RoleService],
    exports: [],
  })
  export class SaleReturnModule {}
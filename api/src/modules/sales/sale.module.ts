import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from "src/entities/approle.entity";
import { Customer } from "src/entities/customer.entity";
import { SaleItem } from "src/entities/sale-item.entity";
import { Sale } from "src/entities/sale.entity";
import { RoleService } from "../app/roles/role.service";
import { CustomerService } from "../customers/customer.service";
import { StockService } from "../inventory/stock.service";

import { SaleController } from "./sale.controller";
import { SaleService } from "./sale.service";

@Module({
    imports: [TypeOrmModule.forFeature([Sale,SaleItem,Customer,AppRole])],
    controllers: [SaleController],
    providers: [SaleService,CustomerService,StockService,RoleService],
    exports: [SaleService],
  })
  export class SaleModule {}
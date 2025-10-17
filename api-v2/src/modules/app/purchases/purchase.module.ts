import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { PurchaseItemController } from "./purchase-invoice-items.controller";
import { PurchaseRequestController } from "./purchase-request.controller";
import { PurchaseInvoiceController } from "./purchase-invoice.controller";
import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { PurchaseService } from "./purchase.service";
import { PurchaseOrderController } from "./purchase-order.controller";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Product } from "src/entities/product.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
import { ProductModule } from "../products/product.module";

@Module({
    imports: [TypeOrmModule.forFeature([
      Product,
      PurchaseRequest,
      PurchaseOrder,
      PurchaseInvoice,
      PurchaseInvoiceItem]),AuthModule,ProductModule],
    controllers: [
      PurchaseRequestController,
      PurchaseOrderController,
      PurchaseInvoiceController,
      PurchaseItemController],
    providers: [PurchaseService,PurchaseInvoiceService,JwtService],
    exports: [PurchaseService,PurchaseInvoiceService],
  })
  export class PurchaseModule {}
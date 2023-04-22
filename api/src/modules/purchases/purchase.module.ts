import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from "src/entities/product.entity";

import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseItemController } from "./purchase-invoice-items.controller";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseRequestController } from "./purchase-request.controller";
import { PurchaseInvoiceController } from "./purchase-invoice.controller";
import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseService } from "./purchase.service";
import { PurchaseOrderController } from "./purchase-order.controller";

@Module({
    imports: [TypeOrmModule.forFeature([
      Product,
      PurchaseRequest,
      PurchaseOrder,
      PurchaseInvoice,
      PurchaseInvoiceItem])],
    controllers: [
      PurchaseRequestController,
      PurchaseOrderController,
      PurchaseInvoiceController,
      PurchaseItemController],
    providers: [PurchaseService,PurchaseInvoiceService],
    exports: [PurchaseService,PurchaseInvoiceService],
  })
  export class PurchaseInvoiceModule {}
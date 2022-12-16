import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from "src/entities/product.entity";

import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceController } from "./invoice.controller";
import { PurchaseInvoiceService } from "./invoice.service";
import { PurchaseItemController } from "./items.controller";

@Module({
    imports: [TypeOrmModule.forFeature([PurchaseInvoice,PurchaseInvoiceItem,Product])],
    controllers: [PurchaseInvoiceController,PurchaseItemController],
    providers: [PurchaseInvoiceService],
    exports: [PurchaseInvoiceService],
  })
  export class PurchaseInvoiceModule {}
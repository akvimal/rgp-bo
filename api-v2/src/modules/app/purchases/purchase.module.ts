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
import { AppRole } from "src/entities/approle.entity";
import { Setting } from "src/entities/setting.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { Vendor } from "src/entities/vendor.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
import { ProductModule } from "../products/product.module";
import { VendorPaymentController } from "./vendor-payment.controller";
import { VendorPaymentService } from "./vendor-payment.service";
import { PurchaseSuggestionController } from "./purchase-suggestion.controller";
import { PurchaseDownloadController } from "./purchase-download.controller";

@Module({
    imports: [TypeOrmModule.forFeature([
      Product,
      Vendor,
      PurchaseRequest,
      PurchaseOrder,
      PurchaseInvoice,
      PurchaseInvoiceItem,
      AppRole,
      VendorPayment,
      Setting]),AuthModule,ProductModule],
    controllers: [
      PurchaseRequestController,
      PurchaseOrderController,
      PurchaseSuggestionController,
      PurchaseInvoiceController,
      PurchaseItemController,
      VendorPaymentController,
      PurchaseDownloadController],
    providers: [PurchaseService,PurchaseInvoiceService,VendorPaymentService,JwtService],
    exports: [PurchaseService,PurchaseInvoiceService,VendorPaymentService],
  })
  export class PurchaseModule {}

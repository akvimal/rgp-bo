import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { PurchaseItemController } from "./purchase-invoice-items.controller";
import { PurchaseRequestController } from "./purchase-request.controller";
import { PurchaseInvoiceController } from "./purchase-invoice.controller";
import { TaxCreditController } from "./tax-credit.controller";
import { InvoiceDocumentController } from "./invoice-document.controller";
import { PurchaseAnalyticsController } from "./purchase-analytics.controller";
import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { TaxCreditService } from "./tax-credit.service";
import { PurchaseService } from "./purchase.service";
import { InvoiceDocumentService } from "./invoice-document.service";
import { PurchaseAnalyticsService } from "./purchase-analytics.service";
import { PurchaseOrderController } from "./purchase-order.controller";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoiceTaxCredit } from "src/entities/purchase-invoice-tax-credit.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { PurchaseInvoiceDocument } from "src/entities/purchase-invoice-document.entity";
import { ProductBatch } from "src/entities/product-batch.entity";
import { BatchMovementLog } from "src/entities/batch-movement-log.entity";
import { Document } from "src/entities/document.entity";
import { SalesIntent } from "src/entities/sales-intent.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
import { ProductModule } from "../products/product.module";
import { DocumentModule } from "../documents/document.module";
import { StockModule } from "../stock/stock.module";

@Module({
    imports: [
      TypeOrmModule.forFeature([
        Product,
        ProductPrice2,
        ProductQtyChange,
        PurchaseRequest,
        PurchaseOrder,
        PurchaseInvoice,
        PurchaseInvoiceItem,
        PurchaseInvoiceTaxCredit,
        VendorPayment,
        PurchaseInvoiceDocument,
        ProductBatch,
        BatchMovementLog,
        Document,
        SalesIntent
      ]),
      AuthModule,
      ProductModule,
      DocumentModule,
      StockModule
    ],
    controllers: [
      PurchaseRequestController,
      PurchaseOrderController,
      PurchaseInvoiceController,
      PurchaseItemController,
      TaxCreditController,
      InvoiceDocumentController,
      PurchaseAnalyticsController
    ],
    providers: [
      PurchaseService,
      PurchaseInvoiceService,
      TaxCreditService,
      InvoiceDocumentService,
      PurchaseAnalyticsService,
      JwtService
    ],
    exports: [
      PurchaseService,
      PurchaseInvoiceService,
      TaxCreditService,
      InvoiceDocumentService
    ],
  })
  export class PurchaseModule {}
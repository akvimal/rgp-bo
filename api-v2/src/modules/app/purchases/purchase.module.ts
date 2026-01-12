import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { PurchaseItemController } from "./purchase-invoice-items.controller";
import { PurchaseRequestController } from "./purchase-request.controller";
import { PurchaseInvoiceController } from "./purchase-invoice.controller";
import { TaxCreditController } from "./tax-credit.controller";
import { InvoiceDocumentController } from "./invoice-document.controller";
import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { TaxCreditService } from "./tax-credit.service";
import { PurchaseService } from "./purchase.service";
import { InvoiceDocumentService } from "./invoice-document.service";
import { PurchaseOrderController } from "./purchase-order.controller";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Product } from "src/entities/product.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoiceTaxCredit } from "src/entities/purchase-invoice-tax-credit.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { PurchaseInvoiceDocument } from "src/entities/purchase-invoice-document.entity";
import { Document } from "src/entities/document.entity";
import { SalesIntent } from "src/entities/sales-intent.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
import { ProductModule } from "../products/product.module";
import { DocumentModule } from "../documents/document.module";

@Module({
    imports: [TypeOrmModule.forFeature([
      Product,
      PurchaseRequest,
      PurchaseOrder,
      PurchaseInvoice,
      PurchaseInvoiceItem,
      PurchaseInvoiceTaxCredit,
      VendorPayment,
      PurchaseInvoiceDocument,
      Document,
      SalesIntent]),AuthModule,ProductModule,DocumentModule],
    controllers: [
      PurchaseRequestController,
      PurchaseOrderController,
      PurchaseInvoiceController,
      PurchaseItemController,
      TaxCreditController,
      InvoiceDocumentController],
    providers: [PurchaseService,PurchaseInvoiceService,TaxCreditService,InvoiceDocumentService,JwtService],
    exports: [PurchaseService,PurchaseInvoiceService,TaxCreditService,InvoiceDocumentService],
  })
  export class PurchaseModule {}
import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { VendorController } from "./vendor.controller";
import { VendorService } from "./vendor.service";
import { Vendor } from "src/entities/vendor.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";

import { ProductModule } from "../products/product.module";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseModule } from "../purchases/purchase.module";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";

@Module({
    imports: [TypeOrmModule.forFeature([Vendor]),AuthModule],
    controllers: [VendorController],
    providers: [VendorService,JwtService],
    exports: [VendorService],
  })
  export class VendorModule {}
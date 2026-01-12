import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PurchaseInvoiceService } from "../purchases/purchase-invoice.service";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";
import { Stock2Controller } from "./stock2.controller";
import { Stock2Service } from "./stock2.service";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { Product } from "src/entities/product.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";

@Module({
    imports: [TypeOrmModule.forFeature([Product, ProductPriceChange, ProductQtyChange, PurchaseInvoice, PurchaseInvoiceItem, VendorPayment]),AuthModule],
    controllers: [StockController,Stock2Controller],
    providers: [StockService,Stock2Service,PurchaseInvoiceService,JwtService],
    exports: [StockService, PurchaseInvoiceService],
  })
  export class StockModule {}

  
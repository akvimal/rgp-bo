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
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { Vendor } from "src/entities/vendor.entity";
import { Business } from "src/entities/business.entity";
import { Store } from "src/entities/store.entity";
import { StoreStockTransfer } from "src/entities/store-stock-transfer.entity";
import { Setting } from "src/entities/setting.entity";
import { StockCount } from "src/entities/stock-count.entity";
import { StoreStockTransferController } from "./store-stock-transfer.controller";
import { StoreStockTransferService } from "./store-stock-transfer.service";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";
import { RoleModule } from "../roles/role.module";

@Module({
    imports: [TypeOrmModule.forFeature([Product, ProductPriceChange, ProductQtyChange, PurchaseInvoice, PurchaseInvoiceItem, PurchaseOrder, PurchaseRequest, VendorPayment, Vendor, Business, Store, StoreStockTransfer, Setting, StockCount]),AuthModule,RoleModule],
    controllers: [StockController,Stock2Controller,StoreStockTransferController],
    providers: [StockService,Stock2Service,PurchaseInvoiceService,StoreStockTransferService,JwtService],
    exports: [StockService, PurchaseInvoiceService, StoreStockTransferService],
  })
  export class StockModule {}

  

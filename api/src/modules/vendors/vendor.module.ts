import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";

import { Vendor } from "src/entities/vendor.entity";
import { VendorController } from "./vendor.controller";
import { VendorService } from "./vendor.service";

@Module({
    imports: [TypeOrmModule.forFeature([Vendor])],
    controllers: [VendorController],
    providers: [VendorService],
    exports: [VendorService],
  })
  export class VendorModule {}
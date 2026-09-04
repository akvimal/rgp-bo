import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";
import { RoleModule } from "../roles/role.module";
import { GstReturnPeriod } from "src/entities/gst-return-period.entity";
import { GstInwardSupply } from "src/entities/gst-inward-supply.entity";
import { GstReconciliation } from "src/entities/gst-reconciliation.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Business } from "src/entities/business.entity";
import { Vendor } from "src/entities/vendor.entity";
import { GstController } from "./gst.controller";
import { GstService } from "./gst.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([GstReturnPeriod, GstInwardSupply, GstReconciliation, PurchaseInvoice, Business, Vendor]),
        AuthModule,
        RoleModule,
    ],
    controllers: [GstController],
    providers: [GstService, JwtService],
    exports: [GstService],
})
export class GstModule {}

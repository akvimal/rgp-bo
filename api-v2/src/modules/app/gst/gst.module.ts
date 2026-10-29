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
import { GstRatesController } from "./gst-rates.controller";
import { GstRatesService } from "./gst-rates.service";
import { GstRegistrationController } from "./gst-registration.controller";
import { GstRegisterController } from "./gst-register.controller";
import { GstRegisterService } from "./gst-register.service";
import { GstRegistrationService } from "./gst-registration.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([GstReturnPeriod, GstInwardSupply, GstReconciliation, PurchaseInvoice, Business, Vendor]),
        AuthModule,
        RoleModule,
    ],
    controllers: [GstController, GstRatesController, GstRegistrationController, GstRegisterController],
    providers: [GstService, GstRatesService, GstRegistrationService, GstRegisterService, JwtService],
    exports: [GstService, GstRatesService, GstRegistrationService],
})
export class GstModule {}

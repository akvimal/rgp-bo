import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";
import { DeliveryPartner } from "src/entities/delivery-partner.entity";
import { DeliveryPartnerController } from "./delivery-partner.controller";
import { DeliveryPartnerService } from "./delivery-partner.service";

@Module({
    imports: [TypeOrmModule.forFeature([DeliveryPartner]), AuthModule],
    controllers: [DeliveryPartnerController],
    providers: [DeliveryPartnerService, JwtService],
    exports: [DeliveryPartnerService],
})
export class DeliveryPartnerModule {}

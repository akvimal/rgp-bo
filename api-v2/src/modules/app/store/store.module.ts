import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";
import { Store } from "src/entities/store.entity";
import { StoreCashAccount } from "src/entities/store-cash-account.entity";
import { StoreShift } from "src/entities/store-shift.entity";
import { StoreShiftTemplate } from "src/entities/store-shift-template.entity";
import { AppUser } from "src/entities/appuser.entity";
import { UserStore } from "src/entities/user-store.entity";
import { Business } from "src/entities/business.entity";
import { StoreController } from "./store.controller";
import { StoreCashController } from "./store-cash.controller";
import { StoreService } from "./store.service";

@Module({
  imports: [TypeOrmModule.forFeature([Store, StoreCashAccount, StoreShift, StoreShiftTemplate, AppUser, UserStore, Business]), AuthModule],
  controllers: [StoreController, StoreCashController],
  providers: [StoreService, JwtService],
  exports: [StoreService],
})
export class StoreModule {}

import { Module } from "@nestjs/common";
import { ComplianceModule } from '../compliance/compliance.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";
import { RoleModule } from "../roles/role.module";
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
import { ChecklistAssistant } from "./checklist-assistant";
import { AiProvider } from "../alerts/ai-provider";

@Module({
  imports: [TypeOrmModule.forFeature([Store, StoreCashAccount, StoreShift, StoreShiftTemplate, AppUser, UserStore, Business]), AuthModule, RoleModule, ComplianceModule],
  controllers: [StoreController, StoreCashController],
  providers: [StoreService, JwtService, ChecklistAssistant, AiProvider],
  exports: [StoreService],
})
export class StoreModule {}

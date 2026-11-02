import { Module } from "@nestjs/common";
import { ComplianceModule } from '../compliance/compliance.controller';
import { MessagingModule } from '../messaging/messaging.module';
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";
import { RoleModule } from "../roles/role.module";
import { Store } from "src/entities/store.entity";
import { StoreCashAccount } from "src/entities/store-cash-account.entity";
import { StoreVaultMovement } from "src/entities/store-vault-movement.entity";
import { StoreVaultCount } from "src/entities/store-vault-count.entity";
import { StoreShift } from "src/entities/store-shift.entity";
import { StoreShiftTemplate } from "src/entities/store-shift-template.entity";
import { AppUser } from "src/entities/appuser.entity";
import { UserStore } from "src/entities/user-store.entity";
import { Business } from "src/entities/business.entity";
import { StoreController } from "./store.controller";
import { StoreCashController } from "./store-cash.controller";
import { StoreService } from "./store.service";
import { VaultController } from "./vault.controller";
import { VaultService } from "./vault.service";
import { ChecklistAssistant } from "./checklist-assistant";
import { AiProvider } from "../alerts/ai-provider";

@Module({
  imports: [TypeOrmModule.forFeature([Store, StoreCashAccount, StoreVaultMovement, StoreVaultCount, StoreShift, StoreShiftTemplate, AppUser, UserStore, Business]), AuthModule, RoleModule, ComplianceModule, MessagingModule],
  controllers: [StoreController, StoreCashController, VaultController],
  providers: [StoreService, VaultService, JwtService, ChecklistAssistant, AiProvider],
  exports: [StoreService],
})
export class StoreModule {}

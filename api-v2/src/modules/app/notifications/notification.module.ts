import { Module } from "@nestjs/common";
import { AuthModule } from "src/modules/auth/auth.module";
import { PurchaseModule } from "../purchases/purchase.module";
import { DailyDigestBuilder } from "./daily-digest.builder";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { TelegramClient } from "./telegram.client";

@Module({
  imports: [PurchaseModule, AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService, DailyDigestBuilder, TelegramClient],
})
export class NotificationModule {}

import { Module } from "@nestjs/common";
import { AuthModule } from "src/modules/auth/auth.module";
import { MessagingModule } from "../messaging/messaging.module";
import { PurchaseModule } from "../purchases/purchase.module";
import { DailyDigestBuilder } from "./daily-digest.builder";
import { DayDetailBuilder } from "./day-digest.builder";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { TelegramClient } from "./telegram.client";

@Module({
  imports: [PurchaseModule, AuthModule, MessagingModule],
  controllers: [NotificationController],
  providers: [NotificationService, DailyDigestBuilder, DayDetailBuilder, TelegramClient],
})
export class NotificationModule {}

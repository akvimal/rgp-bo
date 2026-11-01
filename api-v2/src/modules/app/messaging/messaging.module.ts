import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ShiftDigestService } from './shift-digest.service';
import { TelegramAdapter } from './telegram.adapter';

/** Alerts sent outside the app (staff on Telegram first), through an outbox. The alerts engine calls MessagingService when an alert opens. */
@Module({
  imports: [AuthModule],
  controllers: [MessagingController],
  providers: [MessagingService, TelegramAdapter, ShiftDigestService],
  exports: [MessagingService, ShiftDigestService],
})
export class MessagingModule {}

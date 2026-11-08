import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StoreModule } from '../store/store.module';
import { MessagingModule } from '../messaging/messaging.module';
import { HrModule } from '../hr/hr.module';
import { AiProvider } from './ai-provider';
import { AiSettingsService } from './ai-settings.service';
import { AlertDrafter } from './alert-drafter';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [AuthModule, StoreModule, MessagingModule, HrModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertDrafter, AiProvider, AiSettingsService],
  exports: [AiSettingsService],
})
export class AlertsModule {}

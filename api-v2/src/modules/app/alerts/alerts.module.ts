import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StoreModule } from '../store/store.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AiProvider } from './ai-provider';
import { AlertDrafter } from './alert-drafter';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [AuthModule, StoreModule, MessagingModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertDrafter, AiProvider],
})
export class AlertsModule {}

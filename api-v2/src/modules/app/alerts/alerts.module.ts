import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StoreModule } from '../store/store.module';
import { AlertDrafter } from './alert-drafter';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [AuthModule, StoreModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertDrafter],
})
export class AlertsModule {}

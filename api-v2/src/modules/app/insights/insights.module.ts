import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AiCacheService } from '../alerts/ai-cache.service';
import { AiProvider } from '../alerts/ai-provider';
import { MessagingModule } from '../messaging/messaging.module';
import { InsightsController } from './insights.controller';
import { InsightsData } from './insights-data.service';
import { InsightsService } from './insights.service';
import { ReportHubService } from './report-hub.service';

/** Ask the shop, the buying brief, the weekly owner summary and staff coaching notes. */
@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [InsightsController],
  providers: [InsightsService, ReportHubService, InsightsData, AiProvider, AiCacheService],
})
export class InsightsModule {}

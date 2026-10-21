import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { GrievanceController } from './grievance.controller';
import { GrievanceService } from './grievance.service';
import { QualityController } from './quality.controller';
import { QualityService } from './quality.service';
import { DiscrepancyService } from './discrepancy.service';
import { RefillController } from './refill.controller';
import { RefillService } from './refill.service';

@Module({
  imports: [AuthModule],
  controllers: [QualityController, GrievanceController, RefillController],
  providers: [QualityService, GrievanceService, DiscrepancyService, RefillService],
})
export class QualityModule {}

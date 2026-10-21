import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { GrievanceController } from './grievance.controller';
import { GrievanceService } from './grievance.service';
import { QualityController } from './quality.controller';
import { QualityService } from './quality.service';
import { DiscrepancyService } from './discrepancy.service';

@Module({
  imports: [AuthModule],
  controllers: [QualityController, GrievanceController],
  providers: [QualityService, GrievanceService, DiscrepancyService],
})
export class QualityModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { HrController, HrGuard } from './hr.controller';
import { HrStaffService } from './hr-staff.service';
import { HrLeaveService } from './hr-leave.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrKpiService } from './hr-kpi.service';

@Module({
  imports: [AuthModule],
  controllers: [HrController],
  providers: [HrGuard, HrStaffService, HrLeaveService, HrPayrollService, HrKpiService],
})
export class HrModule {}

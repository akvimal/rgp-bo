import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { HrController, HrGuard } from './hr.controller';
import { HrStaffService } from './hr-staff.service';
import { HrLeaveService } from './hr-leave.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrKpiService } from './hr-kpi.service';
import { HrKpiEngine } from './hr-kpi-engine.service';
import { KpiPeopleController, KpiPeopleGuard } from './kpi-people.controller';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [HrController, KpiPeopleController],
  providers: [HrGuard, KpiPeopleGuard, HrStaffService, HrLeaveService, HrPayrollService, HrKpiService, HrKpiEngine],
})
export class HrModule {}

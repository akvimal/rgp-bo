import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { HrController, HrGuard } from './hr.controller';
import { HrStaffService } from './hr-staff.service';
import { HrLeaveService } from './hr-leave.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrBonusService } from './hr-bonus.service';
import { HrKpiService } from './hr-kpi.service';
import { HrKpiEngine } from './hr-kpi-engine.service';
import { KpiPeopleController, KpiPeopleGuard } from './kpi-people.controller';
import { HrSelfController, HrSelfGuard, LeaveApprovalController } from './hr-self.controller';
import { HrSelfService, LeaveApprovalService } from './hr-self.service';
import { AttendanceReviewService, PunchService } from './hr-punch.service';
import { AttendanceReviewController, PunchController } from './hr-punch.controller';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [HrController, KpiPeopleController, HrSelfController, LeaveApprovalController, PunchController, AttendanceReviewController],
  providers: [PunchService, AttendanceReviewService, HrGuard, KpiPeopleGuard, HrSelfGuard, HrSelfService, LeaveApprovalService, HrStaffService, HrLeaveService, HrPayrollService, HrBonusService, HrKpiService, HrKpiEngine],
})
export class HrModule {}

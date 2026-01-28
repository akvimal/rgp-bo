import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Shift } from '../../entities/shift.entity';
import { UserShift } from '../../entities/user-shift.entity';
import { Attendance } from '../../entities/attendance.entity';
import { LeaveType } from '../../entities/leave-type.entity';
import { LeaveRequest } from '../../entities/leave-request.entity';
import { LeaveBalance } from '../../entities/leave-balance.entity';
import { UserScore } from '../../entities/user-score.entity';
import { SystemPerformanceLog } from '../../entities/system-performance-log.entity';
import { ApiUsageLog } from '../../entities/api-usage-log.entity';
import { QueryPerformanceLog } from '../../entities/query-performance-log.entity';
import { AuditLog } from '../../entities/audit-log.entity';

// Policy & Benefits Entities
import { HrPolicyMaster } from '../../entities/hr-policy-master.entity';
import { HrPolicyAcknowledgment } from '../../entities/hr-policy-acknowledgment.entity';
import { BenefitMaster } from '../../entities/benefit-master.entity';
import { BenefitPolicy } from '../../entities/benefit-policy.entity';
import { EmployeeBenefitEnrollment } from '../../entities/employee-benefit-enrollment.entity';
import { BenefitClaim } from '../../entities/benefit-claim.entity';
import { PolicyEligibilityRule } from '../../entities/policy-eligibility-rule.entity';

// Services
import { ShiftService } from './shift/shift.service';
import { AttendanceService } from './attendance/attendance.service';
import { LeaveService } from './leave/leave.service';
import { ScoringService } from './scoring/scoring.service';
import { ReportingService } from './reporting/reporting.service';
import { PerformanceMonitoringService } from '../../core/monitoring/performance-monitoring.service';

// Policy & Benefits Services
import { PoliciesService } from './policies/policies.service';
import { BenefitsService } from './benefits/benefits.service';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { ClaimsService } from './claims/claims.service';

// Controllers
import { ShiftController } from './shift/shift.controller';
import { AttendanceController } from './attendance/attendance.controller';
import { LeaveController } from './leave/leave.controller';
import { ScoringController } from './scoring/scoring.controller';
import { ReportingController } from './reporting/reporting.controller';

// Policy & Benefits Controllers
import { PoliciesController } from './policies/policies.controller';
import { BenefitsController } from './benefits/benefits.controller';
import { EnrollmentsController } from './enrollments/enrollments.controller';
import { ClaimsController } from './claims/claims.controller';

// Tasks
import { HrTasksService } from './tasks/hr.tasks.service';

// Core Modules
import { RedisCacheModule } from '../../core/cache/redis-cache.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // HR Entities
      Shift,
      UserShift,
      Attendance,
      LeaveType,
      LeaveRequest,
      LeaveBalance,
      UserScore,
      // Monitoring Entities
      SystemPerformanceLog,
      ApiUsageLog,
      QueryPerformanceLog,
      AuditLog,
      // Policy & Benefits Entities
      HrPolicyMaster,
      HrPolicyAcknowledgment,
      BenefitMaster,
      BenefitPolicy,
      EmployeeBenefitEnrollment,
      BenefitClaim,
      PolicyEligibilityRule,
    ]),
    RedisCacheModule,
    AuthModule,
  ],
  controllers: [
    ShiftController,
    AttendanceController,
    LeaveController,
    ScoringController,
    ReportingController,
    // Policy & Benefits Controllers
    PoliciesController,
    BenefitsController,
    EnrollmentsController,
    ClaimsController,
  ],
  providers: [
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    PerformanceMonitoringService,
    HrTasksService,
    // Policy & Benefits Services
    PoliciesService,
    BenefitsService,
    EnrollmentsService,
    ClaimsService,
  ],
  exports: [
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    PerformanceMonitoringService,
    // Policy & Benefits Services
    PoliciesService,
    BenefitsService,
    EnrollmentsService,
    ClaimsService,
  ],
})
export class HrModule {}

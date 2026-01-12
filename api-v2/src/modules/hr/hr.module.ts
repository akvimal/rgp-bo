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
import { HrAuditLog } from '../../entities/hr-audit-log.entity';

// Services
import { ShiftService } from './shift/shift.service';
import { AttendanceService } from './attendance/attendance.service';
import { LeaveService } from './leave/leave.service';
import { ScoringService } from './scoring/scoring.service';
import { ReportingService } from './reporting/reporting.service';
import { PerformanceMonitoringService } from '../../core/monitoring/performance-monitoring.service';

// Controllers
import { ShiftController } from './shift/shift.controller';
import { AttendanceController } from './attendance/attendance.controller';
import { LeaveController } from './leave/leave.controller';
import { ScoringController } from './scoring/scoring.controller';
import { ReportingController } from './reporting/reporting.controller';

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
      HrAuditLog,
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
  ],
  providers: [
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    PerformanceMonitoringService,
    HrTasksService,
  ],
  exports: [
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    PerformanceMonitoringService,
  ],
})
export class HrModule {}

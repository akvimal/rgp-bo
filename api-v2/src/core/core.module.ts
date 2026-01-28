import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionService } from './services/permission.service';
import { PermissionGenerationService } from './services/permission-generation.service';
import { DataScopeService } from './services/data-scope.service';
import { ExpiryMonitoringService } from './monitoring/expiry-monitoring.service';
import { StockVarianceDetectionService } from './monitoring/stock-variance-detection.service';
import { UserRoleAssignment } from '../entities/user-role-assignment.entity';
import { AppRole } from '../entities/approle.entity';
import { RoleFeatureAssignment } from '../entities/role-feature-assignment.entity';
import { AppUser } from '../entities/appuser.entity';
import { AuditModule } from './audit/audit.module';
import { StockModule } from '../modules/app/stock/stock.module';

/**
 * CoreModule
 *
 * Global module that provides core services like permission resolution and data scope filtering.
 * Exported globally so all modules can use these services without importing.
 *
 * Services:
 * - PermissionService: Multi-role permission resolution and merging
 * - PermissionGenerationService: Generate permissions from feature group assignments
 * - DataScopeService: Enforce data scope filtering on queries (all/team/own)
 * - AuditService: Audit logging for administrative actions (via AuditModule)
 * - ExpiryMonitoringService: Automated batch expiry monitoring with cron jobs
 * - StockVarianceDetectionService: Automated stock variance detection and alerting
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserRoleAssignment, AppRole, RoleFeatureAssignment, AppUser]),
    AuditModule,
    StockModule
  ],
  providers: [
    PermissionService,
    PermissionGenerationService,
    DataScopeService,
    ExpiryMonitoringService,
    StockVarianceDetectionService
  ],
  exports: [
    PermissionService,
    PermissionGenerationService,
    DataScopeService,
    AuditModule,
    ExpiryMonitoringService,
    StockVarianceDetectionService
  ]
})
export class CoreModule {}

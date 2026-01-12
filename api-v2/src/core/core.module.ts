import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionService } from './services/permission.service';
import { PermissionGenerationService } from './services/permission-generation.service';
import { DataScopeService } from './services/data-scope.service';
import { UserRoleAssignment } from '../entities/user-role-assignment.entity';
import { AppRole } from '../entities/approle.entity';
import { RoleFeatureAssignment } from '../entities/role-feature-assignment.entity';
import { AppUser } from '../entities/appuser.entity';

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
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserRoleAssignment, AppRole, RoleFeatureAssignment, AppUser])],
  providers: [PermissionService, PermissionGenerationService, DataScopeService],
  exports: [PermissionService, PermissionGenerationService, DataScopeService]
})
export class CoreModule {}

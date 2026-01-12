import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureGroupController } from './feature-group.controller';
import { FeatureGroupService } from './feature-group.service';
import { FeatureGroup } from '../../../entities/feature-group.entity';
import { AccessLevel } from '../../../entities/access-level.entity';
import { SubFeature } from '../../../entities/sub-feature.entity';
import { SubFeatureAccessLevel } from '../../../entities/sub-feature-access-level.entity';
import { RoleFeatureAssignment } from '../../../entities/role-feature-assignment.entity';
import { RoleSubFeatureAssignment } from '../../../entities/role-sub-feature-assignment.entity';
import { AppRole } from '../../../entities/approle.entity';
import { CoreModule } from '../../../core/core.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeatureGroup,
      AccessLevel,
      SubFeature,
      SubFeatureAccessLevel,
      RoleFeatureAssignment,
      RoleSubFeatureAssignment,
      AppRole,
    ]),
    CoreModule, // For PermissionGenerationService
    AuthModule, // For AuthGuard and JwtService
  ],
  controllers: [FeatureGroupController],
  providers: [FeatureGroupService],
  exports: [FeatureGroupService],
})
export class FeatureGroupModule {}

import { Module } from '@nestjs/common';

import { RoleController } from './role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from 'src/entities/appuser.entity';
import { AppRole } from 'src/entities/approle.entity';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { JwtService } from '@nestjs/jwt';
import { PermissionGuard } from 'src/core/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser,AppRole]),AuthModule],
  controllers: [RoleController],
  providers: [RoleService, PermissionService, JwtService, PermissionGuard],
  exports: [RoleService, PermissionService, PermissionGuard]
})
export class RoleModule {}

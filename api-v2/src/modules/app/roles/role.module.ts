import { Module } from '@nestjs/common';

import { RoleController } from './role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from 'src/entities/appuser.entity';
import { AppRole } from 'src/entities/approle.entity';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleService } from './role.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser,AppRole]),AuthModule],
  controllers: [RoleController],
  providers: [RoleService,JwtService],
  exports: [RoleService]
})
export class RoleModule {}
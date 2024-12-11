import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from '../../../entities/approle.entity';
import { AppUser } from '../../../entities/appuser.entity';
import { AuthModule } from '../../../modules/app/auth/auth.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser,AppRole]),AuthModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService]
})
export class RoleModule {}
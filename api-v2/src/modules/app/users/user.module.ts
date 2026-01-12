import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from '../../../entities/approle.entity';
import { AppUser } from '../../../entities/appuser.entity';
import { UserRoleAssignment } from '../../../entities/user-role-assignment.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRoleController } from './user-role.controller';
import { UserRoleService } from './user-role.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser, AppRole, UserRoleAssignment]), AuthModule],
  controllers: [UserController, UserRoleController],
  providers: [UserService, UserRoleService, JwtService],
  exports: [UserService, UserRoleService]
})
export class UserModule {}
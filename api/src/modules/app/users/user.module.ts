import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from 'src/entities/approle.entity';
import { AppUser } from '../../../entities/AppUser.entity';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser,AppRole]),AuthModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
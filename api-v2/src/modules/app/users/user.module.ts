import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from '../../../entities/approle.entity';
import { AppUser } from '../../../entities/appuser.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser,AppRole]),AuthModule],
  controllers: [UserController],
  providers: [UserService,JwtService],
  exports: [UserService]
})
export class UserModule {}
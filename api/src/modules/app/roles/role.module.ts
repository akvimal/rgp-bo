import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from 'src/entities/approle.entity';
import { AppUser } from 'src/entities/AppUser.entity';
import { AuthModule } from 'src/modules/app/auth/auth.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser,AppRole]),AuthModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService]
})
export class RoleModule {}
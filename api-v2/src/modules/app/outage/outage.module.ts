import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { OutageController } from './outage.controller';
import { OutageService } from './outage.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [OutageController],
  providers: [OutageService, JwtService],
})
export class OutageModule {}

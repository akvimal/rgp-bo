import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StaffCreditController } from './staff-credit.controller';
import { StaffCreditService } from './staff-credit.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffCreditController],
  providers: [StaffCreditService],
})
export class StaffCreditModule {}

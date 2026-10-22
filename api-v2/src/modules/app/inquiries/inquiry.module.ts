import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { InquiryController, InquiryGuard } from './inquiry.controller';
import { InquiryService } from './inquiry.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [InquiryController],
  providers: [InquiryGuard, InquiryService],
})
export class InquiryModule {}

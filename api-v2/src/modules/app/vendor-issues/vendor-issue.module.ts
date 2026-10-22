import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { VendorIssueController, VendorIssueGuard } from './vendor-issue.controller';
import { VendorIssueService } from './vendor-issue.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [VendorIssueController],
  providers: [VendorIssueGuard, VendorIssueService],
})
export class VendorIssueModule {}

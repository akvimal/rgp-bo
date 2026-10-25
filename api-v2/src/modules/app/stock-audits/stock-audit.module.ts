import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { StockAuditController, StockAuditGuard } from './stock-audit.controller';
import { StockAuditService } from './stock-audit.service';
import { AuditRecordsService } from './audit-records.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [StockAuditController],
  providers: [StockAuditGuard, StockAuditService, AuditRecordsService],
})
export class StockAuditModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { ExpenseController, ExpenseGuard } from './expense.controller';
import { ExpenseService } from './expense.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [ExpenseController],
  providers: [ExpenseGuard, ExpenseService],
})
export class ExpenseModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { StoreModule } from '../store/store.module';
import { ExpenseController, ExpenseGuard } from './expense.controller';
import { ExpenseService } from './expense.service';

@Module({
  imports: [AuthModule, RoleModule, StoreModule],
  controllers: [ExpenseController],
  providers: [ExpenseGuard, ExpenseService],
  exports: [ExpenseService],
})
export class ExpenseModule {}

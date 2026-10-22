import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { PaymentReconController, PaymentReconGuard } from './payment-recon.controller';
import { PaymentReconService } from './payment-recon.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [PaymentReconController],
  providers: [PaymentReconGuard, PaymentReconService],
})
export class PaymentReconModule {}

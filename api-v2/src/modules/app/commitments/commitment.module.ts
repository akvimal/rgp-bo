import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StoreModule } from '../store/store.module';
import { CommitmentController } from './commitment.controller';
import { CommitmentService } from './commitment.service';

@Module({
  imports: [AuthModule, StoreModule],
  controllers: [CommitmentController],
  providers: [CommitmentService, JwtService],
  exports: [CommitmentService],
})
export class CommitmentModule {}

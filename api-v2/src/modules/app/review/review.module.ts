import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [ReviewController],
  providers: [ReviewService, JwtService],
})
export class ReviewModule {}

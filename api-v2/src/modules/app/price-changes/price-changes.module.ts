import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { PriceChangesController } from './price-changes.controller';
import { PriceChangesService } from './price-changes.service';

@Module({
  imports: [AuthModule],
  controllers: [PriceChangesController],
  providers: [PriceChangesService],
})
export class PriceChangesModule {}

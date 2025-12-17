import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DownloadController } from './download.controller';
import { PurchaseOrder } from 'src/entities/purchase-order.entity';
import { PurchaseRequest } from 'src/entities/purchase-request.entity';
import { PurchaseService } from '../purchases/purchase.service';
import { SalesIntent } from 'src/entities/sales-intent.entity';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseRequest, SalesIntent]),
    AuthModule
  ],
  controllers: [DownloadController],
  providers: [PurchaseService]
})
export class DownloadModule {}

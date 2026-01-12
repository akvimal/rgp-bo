import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesIntent } from 'src/entities/sales-intent.entity';
import { SalesIntentItem } from 'src/entities/sales-intent-item.entity';
import { SalesIntentController } from './sales-intent.controller';
import { SalesIntentService } from './sales-intent.service';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([SalesIntent, SalesIntentItem]),
        AuthModule
    ],
    controllers: [SalesIntentController],
    providers: [SalesIntentService],
    exports: [SalesIntentService],
})
export class SalesIntentModule {}

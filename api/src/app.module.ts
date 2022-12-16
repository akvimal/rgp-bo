import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import databaseConfig from './config/database.config';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { RoleModule } from './modules/app/roles/role.module';
import { CustomerModule } from './modules/customers/customer.module';
import { ProductModule } from './modules/products/product.module';
import { PurchaseInvoiceModule } from './modules/purchases/invoice.module';
import { SaleModule } from './modules/sales/sale.module';
import { UserModule } from './modules/app/users/user.module';
import { VendorModule } from './modules/vendors/vendor.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorsInterceptor } from './core/errors.interceptor';
import { InventoryModule } from './modules/inventory/inventory.module';

@Module({
  controllers: [  ],
  providers: [ {
    provide: APP_INTERCEPTOR,
    useClass: ErrorsInterceptor,
  }, ],
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    load: [
      databaseConfig
    ],
    envFilePath: ['.env'],
  }),
  TypeOrmModule.forFeature([  ]),
  TypeOrmModule.forRootAsync({
    useClass: TypeOrmConfigService,
  }),
  RoleModule,
  UserModule,
  ProductModule,
  VendorModule,
  PurchaseInvoiceModule,
  CustomerModule,
  SaleModule,
  InventoryModule
  ]
})
export class AppModule {}

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
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileDownloadController } from './modules/app/download/filedownload.controller';
import { PdfGenerateService } from './modules/app/download/pdfgenerate.service';

@Module({
  controllers: [ AppController, FileDownloadController ],
  providers: [ {
    provide: APP_INTERCEPTOR,
    useClass: ErrorsInterceptor,
  }, AppService, PdfGenerateService],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig
      ],
      envFilePath: ['.env'],
    }),
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

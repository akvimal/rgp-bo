import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './typeorm-config.service';
import { RoleModule } from './modules/app/roles/role.module';
import { UserModule } from './modules/app/users/user.module';
import { VendorModule } from './modules/app/vendors/vendor.module';
import { ProductModule } from './modules/app/products/product.module';
import { PurchaseModule } from './modules/app/purchases/purchase.module';
import { AuthModule } from './modules/auth/auth.module';
import { StockModule } from './modules/app/stock/stock.module';
import { CustomerModule } from './modules/app/customers/customer.module';
import { SaleModule } from './modules/app/sales/sale.module';
import { SaleReturnModule } from './modules/app/returns/salereturn.module';
import { DocumentModule } from './modules/app/documents/document.module';
import { FilesModule } from './modules/app/files/files.module';
import { ReportModule } from './modules/app/reports/report.module';
import { DashboardModule } from './modules/app/dashboard/dashboard.module';
import { LookupModule } from './modules/app/lookup/lookup.module';
import { DeliveryPartnerModule } from './modules/app/delivery-partners/delivery-partner.module';
import { SettingsModule } from './modules/app/settings/settings.module';
import { StoreModule } from './modules/app/store/store.module';
import { BusinessModule } from './modules/app/business/business.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DbBackupService } from './modules/app/backup/db.backup';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestTimingContext } from './core/performance/request-timing.context';
import { RequestTimingInterceptor } from './core/performance/request-timing.interceptor';
import { DbTimingService } from './core/performance/db-timing.service';

@Module({
  imports: [
    ConfigModule.forRoot(), 
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    AuthModule,
    RoleModule,
    UserModule,
    ProductModule,
    VendorModule,
    PurchaseModule,
    StockModule,
    CustomerModule,
    SaleModule,
    SaleReturnModule,
    DocumentModule,
    FilesModule,
    ReportModule,
    DashboardModule,
    LookupModule,
    DeliveryPartnerModule,
    SettingsModule,
    StoreModule,
    BusinessModule
  ],
  controllers: [],
  providers: [
    RequestTimingContext,
    DbTimingService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimingInterceptor,
    },
  ],
})
export class AppModule {}

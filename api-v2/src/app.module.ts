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
import { SalesIntentModule } from './modules/app/sales-intent/sales-intent.module';
import { SaleReturnModule } from './modules/app/returns/salereturn.module';
import { DocumentModule } from './modules/app/documents/document.module';
import { FilesModule } from './modules/app/files/files.module';
import { ReportModule } from './modules/app/reports/report.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DbBackupService } from './modules/app/backup/db.backup';
import { HrModule } from './modules/hr/hr.module';
import { RedisCacheModule } from './core/cache/redis-cache.module';
import { LookupModule } from './modules/app/lookup/lookup.module';
import { DownloadModule } from './modules/app/downloads/download.module';
import { PayrollModule } from './modules/app/payroll/payroll.module';
import { CoreModule } from './core/core.module';
import { FeatureGroupModule } from './modules/app/feature-groups/feature-group.module';
import { BugReportModule } from './modules/app/bug-report/bug-report.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    CoreModule,
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
    SalesIntentModule,
    SaleReturnModule,
    DocumentModule,
    FilesModule,
    ReportModule,
    LookupModule,
    DownloadModule,
    RedisCacheModule,
    HrModule,
    PayrollModule,
    FeatureGroupModule,
    BugReportModule
  ],
  controllers: [],
  providers: [DbBackupService],
})
export class AppModule {}

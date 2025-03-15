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

@Module({
  imports: [
    ConfigModule.forRoot(), 
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
    ReportModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

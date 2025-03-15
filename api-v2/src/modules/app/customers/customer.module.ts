import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";
import { Customer } from "src/entities/customer.entity";
import { CustomerCreditAccount } from "src/entities/customer-credit-account.entity";
import { Sale } from "src/entities/sale.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
@Module({
    imports: [TypeOrmModule.forFeature([Customer,CustomerCreditAccount,Sale]),AuthModule],
    controllers: [CustomerController],
    providers: [CustomerService,JwtService],
    exports: [CustomerService],
  })
  export class CustomerModule {}
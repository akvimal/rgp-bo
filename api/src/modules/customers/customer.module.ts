import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { Customer } from "src/entities/customer.entity";
import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";
import { Sale } from "src/entities/sale.entity";
import { CustomerCreditAccount } from "src/entities/customer-credit-account.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Customer,CustomerCreditAccount,Sale])],
    controllers: [CustomerController],
    providers: [CustomerService],
    exports: [CustomerService],
  })
  export class CustomerModule {}
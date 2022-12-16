import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { Customer } from "src/entities/customer.entity";
import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";
import { Sale } from "src/entities/sale.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Customer,Sale])],
    controllers: [CustomerController],
    providers: [CustomerService],
    exports: [CustomerService],
  })
  export class CustomerModule {}
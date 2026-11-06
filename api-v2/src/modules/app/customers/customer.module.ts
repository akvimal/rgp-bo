import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";
import { CustomerCreditService } from "./customer-credit.service";
import { CustomerDueService } from "./customer-due.service";
import { CustomerDueController } from "./customer-due.controller";
import { CustomerRelationshipService } from "./customer-relationship.service";
import { CustomerPrivacyService } from "./customer-privacy.service";
import { CustomerRelationshipController } from "./customer-relationship.controller";
import { Customer } from "src/entities/customer.entity";
import { CustomerCreditAccount } from "src/entities/customer-credit-account.entity";
import { Sale } from "src/entities/sale.entity";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";
@Module({
    imports: [TypeOrmModule.forFeature([Customer,CustomerCreditAccount,Sale]),AuthModule],
    controllers: [CustomerController, CustomerRelationshipController, CustomerDueController],
    providers: [CustomerService,CustomerCreditService,CustomerDueService,CustomerRelationshipService,CustomerPrivacyService,JwtService],
    exports: [CustomerService],
  })
  export class CustomerModule {}
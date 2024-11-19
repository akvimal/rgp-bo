import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Business } from "src/entities/business.entity";
import { StoreCashAccount } from "src/entities/store-cash-account.entity";
import { Store } from "src/entities/store.entity";
import { BusinessController } from "./business.controller";
import { BusinessService } from "./business.service";

@Module({
    imports: [TypeOrmModule.forFeature([Business, Store, StoreCashAccount])],
    controllers: [BusinessController],
    providers: [BusinessService],
    exports: [BusinessService],
  })
  export class BusinessModule {}

  
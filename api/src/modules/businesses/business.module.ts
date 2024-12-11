import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Business } from "../../entities/business.entity";
import { StoreCashAccount } from "../../entities/store-cash-account.entity";
import { Store } from "../../entities/store.entity";
import { BusinessController } from "./business.controller";
import { BusinessService } from "./business.service";

@Module({
    imports: [TypeOrmModule.forFeature([Business, Store, StoreCashAccount])],
    controllers: [BusinessController],
    providers: [BusinessService],
    exports: [BusinessService],
  })
  export class BusinessModule {}

  
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/modules/auth/auth.module";
import { Business } from "src/entities/business.entity";
import { RoleModule } from "../roles/role.module";
import { UserModule } from "../users/user.module";
import { BusinessController } from "./business.controller";
import { BusinessService } from "./business.service";
import { JwtService } from "@nestjs/jwt";

@Module({
  imports: [TypeOrmModule.forFeature([Business]), AuthModule, RoleModule, UserModule],
  controllers: [BusinessController],
  providers: [BusinessService, JwtService],
  exports: [BusinessService]
})
export class BusinessModule {}

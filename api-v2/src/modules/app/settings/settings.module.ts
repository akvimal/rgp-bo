import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "src/modules/auth/auth.module";
import { Setting } from "src/entities/setting.entity";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
    imports: [TypeOrmModule.forFeature([Setting]), AuthModule],
    controllers: [SettingsController],
    providers: [SettingsService, JwtService],
    exports: [SettingsService],
})
export class SettingsModule {}

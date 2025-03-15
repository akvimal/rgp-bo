import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratorService } from "./generator.service";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";

@Module({
    imports: [TypeOrmModule.forFeature([]),AuthModule],
    controllers: [ReportController],
    providers: [ReportService,GeneratorService,JwtService],
    exports: [ReportService],
  })
  export class ReportModule {}
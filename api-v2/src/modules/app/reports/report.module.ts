import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratorService } from "./generator.service";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { GstReportService } from "./gst-report.service";
import { GstReportController } from "./gst-report.controller";
import { AuthModule } from "src/modules/auth/auth.module";
import { JwtService } from "@nestjs/jwt";

@Module({
    imports: [TypeOrmModule.forFeature([]),AuthModule],
    controllers: [ReportController, GstReportController],
    providers: [ReportService, GstReportService, GeneratorService, JwtService],
    exports: [ReportService, GstReportService],
  })
  export class ReportModule {}
import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratorService } from "./generator.service";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";

@Module({
    imports: [TypeOrmModule.forFeature([])],
    controllers: [ReportController],
    providers: [ReportService,GeneratorService],
    exports: [ReportService],
  })
  export class ReportModule {}
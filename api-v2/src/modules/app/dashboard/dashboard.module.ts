import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/modules/auth/auth.module";
import { PurchaseModule } from "../purchases/purchase.module";
import { StoreModule } from "../store/store.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardMetricsService } from "./dashboard-metrics.service";
import { DashboardFindingsService } from "./dashboard-findings.service";

@Module({
  imports: [TypeOrmModule.forFeature([]), PurchaseModule, AuthModule, StoreModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardMetricsService, DashboardFindingsService],
})
export class DashboardModule {}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/modules/auth/auth.module";
import { PurchaseModule } from "../purchases/purchase.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardMetricsService } from "./dashboard-metrics.service";

@Module({
  imports: [TypeOrmModule.forFeature([]), PurchaseModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardMetricsService],
})
export class DashboardModule {}

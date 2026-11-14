import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/modules/auth/auth.module";
import { PurchaseModule } from "../purchases/purchase.module";
import { StoreModule } from "../store/store.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardMetricsService } from "./dashboard-metrics.service";
import { DashboardFindingsService } from "./dashboard-findings.service";
import { DashboardFinanceService } from "./dashboard-finance.service";
import { DashboardStockService } from "./dashboard-stock.service";
import { DashboardRollupService } from "./dashboard-rollup.service";
import { DashboardDigestService } from "./dashboard-digest.service";
import { DashboardAccountantService } from "./dashboard-accountant.service";
import { MessagingModule } from "../messaging/messaging.module";

@Module({
  imports: [TypeOrmModule.forFeature([]), PurchaseModule, AuthModule, StoreModule, MessagingModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardMetricsService, DashboardFindingsService, DashboardFinanceService, DashboardStockService, DashboardRollupService, DashboardDigestService, DashboardAccountantService],
})
export class DashboardModule {}

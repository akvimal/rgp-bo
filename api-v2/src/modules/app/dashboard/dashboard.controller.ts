import { Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { DashboardService } from "./dashboard.service";
import { DashboardMetricsService } from "./dashboard-metrics.service";

@ApiTags("Dashboard")
@Controller("dashboard")
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService, private readonly metrics: DashboardMetricsService) {}

  @Get("/health")
  health(@Query("storeid") storeid: string, @User() currentUser: any) { return this.metrics.health(currentUser, storeid); }

  @Get("/targets")
  targets(@Query("month") month: string, @User() currentUser: any) { return this.metrics.targets(currentUser, month); }

  @Put("/targets")
  setTarget(@Body() body: any, @User() currentUser: any) { return this.metrics.setTarget(currentUser, body); }

  @Get("/metrics/sales-by-month")
  salesByMonth(@Query("storeid") storeid: string, @User() currentUser: any) { return this.metrics.salesByMonth(currentUser, storeid); }

  @Get("/metrics/categories")
  categories(@Query("storeid") storeid: string, @Query("month") month: string, @User() currentUser: any) { return this.metrics.categories(currentUser, storeid, month); }

  @Get("/metrics/customers")
  customers(@Query("storeid") storeid: string, @User() currentUser: any) { return this.metrics.customers(currentUser, storeid); }

  @Get("/metrics/busy-hours")
  busyHours(@Query("storeid") storeid: string, @User() currentUser: any) { return this.metrics.busyHours(currentUser, storeid); }

  @Get("/metrics/payables")
  payables(@Query("storeid") storeid: string, @User() currentUser: any) { return this.metrics.payables(currentUser, storeid); }

  @Get("/view")
  view(@User() currentUser: any) {
    return this.service.view(currentUser);
  }

  @Get("/mine")
  mine(@User() currentUser: any) {
    return this.service.mine(currentUser);
  }

  @Get("/summary")
  summary(@Query() query: any, @User() currentUser: any) {
    return this.service.summary(query, currentUser);
  }

  @Get("/trends")
  trends(@Query() query: any, @User() currentUser: any) {
    return this.service.trends(query, currentUser);
  }

  @Get("/admin-summary")
  adminSummary(@User() currentUser: any) {
    return this.service.adminSummary(currentUser?.roleid, currentUser?.id);
  }
}

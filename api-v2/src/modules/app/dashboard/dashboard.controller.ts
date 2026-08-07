import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("Dashboard")
@Controller("dashboard")
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("/summary")
  summary(@Query() query: any, @User() _currentUser: any) {
    return this.service.summary(query);
  }

  @Get("/trends")
  trends(@Query() query: any) {
    return this.service.trends(query);
  }

  @Get("/admin-summary")
  adminSummary() {
    return this.service.adminSummary();
  }
}

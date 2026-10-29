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

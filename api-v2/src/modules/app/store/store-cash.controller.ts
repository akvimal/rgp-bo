import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { StoreService } from "./store.service";
import { PermissionService } from "../roles/permission.service";

@ApiTags("Store Cash")
@Controller("store-cash")
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StoreCashController {
  constructor(
    private readonly service: StoreService,
    private readonly permissions: PermissionService,
  ) {}

  @Get("templates")
  findTemplates(@Query() query: any) {
    return this.service.findTemplates(query);
  }

  @Post("templates")
  createTemplate(@Body() body: any, @User() currentUser: any) {
    return this.service.saveTemplate(body, currentUser?.id);
  }

  @Put("templates/:id")
  updateTemplate(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
    return this.service.updateTemplate(Number(id), body, currentUser?.id);
  }

  @Get("shifts")
  findShifts(@Query() query: any) {
    return this.service.findShifts(query);
  }

  @Get("shifts/:id/report")
  getShiftReport(@Param("id") id: string) {
    return this.service.getShiftReport(Number(id));
  }

  @Post("shifts")
  async createShift(@Body() body: any, @User() currentUser: any) {
    await this.permissions.assertCanOpenShift(currentUser?.roleid);
    return this.service.createShift(body, currentUser?.id);
  }

  @Put("shifts/:id/close")
  async closeShift(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
    await this.permissions.assertCanCloseShift(currentUser?.roleid);
    return this.service.closeShift(Number(id), body, currentUser?.id);
  }

  @Put("shifts/:id/assign")
  async assignShift(@Param("id") id: string, @Body() body: any, @User() currentUser: any) {
    await this.permissions.assertCanManageShifts(currentUser?.roleid);
    return this.service.assignShift(Number(id), body, currentUser?.id);
  }

  @Get("users")
  findUsers(@Query() query: any) {
    return this.service.findUsers(query);
  }

  @Get("ledger")
  findLedger(@Query() query: any) {
    return this.service.findLedger(query);
  }

  @Post("ledger")
  async createLedger(@Body() body: any, @User() currentUser: any) {
    // anyone who can run a till can record its cash movements
    await this.permissions.assertCanCloseShift(currentUser?.roleid);
    return this.service.saveLedger(body, currentUser?.id);
  }

  @Get("dashboard")
  getDashboard(@Query() query: any, @User() currentUser: any) {
    return this.service.getDashboard(query, currentUser?.id);
  }

  @Get("expenses/summary")
  getExpenseSummary(@Query() query: any) {
    return this.service.getExpenseSummary(query);
  }
}

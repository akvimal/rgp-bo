import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
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

  /** whether the store is already open today (another shift is open, or one ran earlier today): the opening checklist differs */
  @Get("opening-context")
  openingContext(@Query() query: any, @User() currentUser: any) {
    return this.service.openingContext(query, currentUser?.id);
  }

  /** the checklists in force for a store: what a person ticks when opening, handing over or closing */
  @Get("checklists")
  checklists(@Query() query: any) {
    return this.service.checklistsFor(query);
  }

  /** for the editor (a Business Head): the lists at the business's level or one store's */
  @Get("checklists/config")
  checklistConfig(@Query() query: any, @User() currentUser: any) {
    return this.service.checklistConfig(query, currentUser?.id);
  }

  /** suggestions from the last 30 days (?ai=false for the plain, rule-based ones only) */
  @Get("checklists/suggestions")
  checklistSuggestions(@Query() query: any, @User() currentUser: any) {
    return this.service.checklistSuggestions(query, currentUser?.id);
  }

  /** items for a situation the owner describes in a sentence or two */
  @Post("checklists/draft")
  checklistDraft(@Body() body: any, @User() currentUser: any) {
    return this.service.checklistDraft(body, currentUser?.id);
  }

  @Put("checklists")
  saveChecklist(@Body() body: any, @User() currentUser: any) {
    return this.service.saveChecklist(body, currentUser?.id);
  }

  @Delete("checklists")
  resetChecklist(@Query() query: any, @User() currentUser: any) {
    return this.service.resetChecklist(query, currentUser?.id);
  }

  @Get("shifts")
  findShifts(@Query() query: any, @User() currentUser: any) {
    return this.service.findShifts(query, currentUser?.id);
  }

  /** How this store runs its tills (shift mode, accountable role, operator rule). */
  @Get("profile")
  getProfile(@Query("storeid") storeid: string) {
    return this.service.getProfile(Number(storeid));
  }

  @Get("shifts/:id/summary")
  getShiftSummary(@Param("id") id: string) {
    return this.service.getShiftSummary(Number(id));
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
    // anyone who can run a cash drawer can record its cash movements
    await this.permissions.assertCanCloseShift(currentUser?.roleid);
    return this.service.saveLedger(body, currentUser?.id);
  }

  @Get("dashboard")
  getDashboard(@Query() query: any, @User() currentUser: any) {
    return this.service.getDashboard(query, currentUser?.id);
  }

  /** every store's bank deposit standing (due or not, why, the next deposit day): the source for deposit reminders */
  @Get("deposit-status")
  getDepositStatus(@User() currentUser: any) {
    return this.service.getDepositStatuses(currentUser?.id);
  }

  @Get("expenses/summary")
  getExpenseSummary(@Query() query: any) {
    return this.service.getExpenseSummary(query);
  }
}

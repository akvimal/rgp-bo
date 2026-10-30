import { Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { HrStaffService } from './hr-staff.service';
import { HrLeaveService } from './hr-leave.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrKpiService } from './hr-kpi.service';
import { HrKpiEngine } from './hr-kpi-engine.service';

/** Salaries, bank details and attendance: the Business Head only. */
@Injectable()
export class HrGuard implements CanActivate {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [req.user?.roleid || 0]);
    if (r?.name !== 'Business Head') throw new ForbiddenException('Only the Business Head can use HR.');
    return true;
  }
}

@ApiTags('HR')
@Controller('hr')
@ApiBearerAuth()
@UseGuards(AuthGuard, HrGuard)
export class HrController {
  constructor(
    private readonly staff: HrStaffService,
    private readonly leave: HrLeaveService,
    private readonly payroll: HrPayrollService,
    private readonly kpi: HrKpiService,
    private readonly engine: HrKpiEngine,
  ) {}

  // ---------------------------------------------------------------- staff
  @Get('staff') list() { return this.staff.list(); }
  @Get('staff/candidates') candidates(@User() u: any) { return this.staff.candidates(u); }
  @Get('stores') stores() { return this.staff.stores(); }
  @Get('staff/:id') get(@Param('id', ParseIntPipe) id: number) { return this.staff.get(id); }
  @Post('staff') create(@Body() b: any, @User() u: any) { return this.staff.create(b, u); }
  @Put('staff/:id') update(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.staff.update(id, b, u); }
  @Delete('staff/:id') removeStaff(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.staff.remove(id, u); }
  @Put('statutory/:code') saveStatutory(@Param('code') code: string, @Body() b: any, @User() u: any) { return this.staff.saveStatutory(code, b, u); }
  @Post('staff/:id/exit') exit(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.staff.exit(id, b, u); }
  @Post('staff/:id/login') linkLogin(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.staff.linkLogin(id, b, u); }
  @Get('staff/:id/accounts') accounts(@Param('id', ParseIntPipe) id: number) { return this.staff.accounts(id); }
  @Put('staff/:id/accounts') saveAccounts(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.staff.saveAccounts(id, b, u); }
  @Post('staff/:id/rejoin') rejoin(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.staff.rejoin(id, u); }
  @Post('staff/:id/revisions') addRevision(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.staff.addRevision(id, b, u); }
  @Delete('revisions/:id') deleteRevision(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.staff.deleteRevision(id, u); }

  @Get('positions/designations') designations() { return this.staff.designationGroups(); }
  @Post('positions/designations') adopt(@Body() b: any, @User() u: any) { return this.staff.adoptDesignations(b, u); }
  @Get('positions') positions() { return this.staff.positions(); }
  @Post('positions') addPosition(@Body() b: any, @User() u: any) { return this.staff.savePosition(null, b, u); }
  @Put('positions/:id') savePosition(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.staff.savePosition(id, b, u); }
  @Delete('positions/:id') removePosition(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.staff.removePosition(id, u); }
  @Get('starter') starter(@User() u: any) { return this.staff.starter(u); }
  @Post('starter') applyStarter(@Body() b: any, @User() u: any) { return this.staff.applyStarter(b, u); }
  @Get('components') components() { return this.staff.components(); }
  @Post('components') addComponent(@Body() b: any, @User() u: any) { return this.staff.saveComponent(null, b, u); }
  @Delete('components/:id') removeComponent(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.staff.removeComponent(id, u); }
  @Put('components/:id') saveComponent(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.staff.saveComponent(id, b, u); }

  // ---------------------------------------------------------------- leave and holidays
  @Get('leave/types') types() { return this.leave.types(); }
  @Post('leave/types') addType(@Body() b: any, @User() u: any) { return this.leave.saveType(null, b, u); }
  @Delete('leave/types/:id') removeType(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.leave.removeType(id, u); }
  @Put('leave/types/:id') saveType(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.leave.saveType(id, b, u); }
  @Get('leave/balances') balances(@Query('year') year: string) { return this.leave.balances(Number(year) || new Date().getFullYear()); }
  @Get('leave/requests') requests(@Query('period') period: string, @Query('status') status: string, @Query('employee') employee: string) {
    return this.leave.requests({ period, status, employee: employee ? Number(employee) : undefined });
  }
  @Post('leave/requests') createLeave(@Body() b: any, @User() u: any) { return this.leave.create(b, u); }
  @Post('leave/requests/:id/decision') decide(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.leave.decide(id, b, u); }
  @Get('holidays') holidays(@Query('year') year: string) { return this.leave.holidays(Number(year) || new Date().getFullYear()); }
  @Post('holidays') addHoliday(@Body() b: any, @User() u: any) { return this.leave.addHoliday(b, u); }
  @Delete('holidays/:date') removeHoliday(@Param('date') date: string, @User() u: any) { return this.leave.removeHoliday(date, u); }

  // ---------------------------------------------------------------- attendance
  @Get('attendance') grid(@Query('period') period: string) { return this.leave.grid(period); }
  @Put('attendance') mark(@Body() b: any, @User() u: any) { return this.leave.mark(b, u); }

  // ---------------------------------------------------------------- KPI
  @Get('roles') roles() { return this.kpi.roles(); }
  @Get('kpi/system-measures') systemMeasures() { return this.engine.systemMeasures(); }
  @Post('kpi/override') override(@Body() b: any, @User() u: any) { return this.engine.override(b, u); }
  @Post('kpi/finalise') finalise(@Body() b: any, @User() u: any) { return this.engine.finalise(b, u); }
  @Post('kpi/reopen') reopenKpi(@Body() b: any, @User() u: any) { return this.engine.reopen(b, u); }
  @Get('kpi/metrics') metrics() { return this.kpi.metrics(); }
  @Post('kpi/metrics') addMetric(@Body() b: any, @User() u: any) { return this.kpi.saveMetric(null, b, u); }
  @Put('kpi/metrics/:id') saveMetric(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.kpi.saveMetric(id, b, u); }
  @Get('kpi/bands') bands() { return this.kpi.bands(); }
  @Put('kpi/bands') saveBands(@Body() b: any, @User() u: any) { return this.kpi.saveBands(b, u); }
  @Get('kpi/month') month(@Query('period') period: string) { return this.kpi.month(period); }
  @Post('kpi/score') score(@Body() b: any, @User() u: any) { return this.kpi.score(b, u); }

  // ---------------------------------------------------------------- payroll
  @Get('payroll') runs() { return this.payroll.runs(); }
  @Get('payroll/stub/:lineId') stub(@Param('lineId', ParseIntPipe) lineId: number) { return this.payroll.stub(lineId); }
  @Put('payroll/lines/:id') editLine(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.payroll.editLine(id, b, u); }
  @Get('payroll/:period') run(@Param('period') period: string) { return this.payroll.get(period); }
  @Get('payroll/:period/export') async export(@Param('period') period: string, @Res() res: any) {
    const buf = await this.payroll.exportXlsx(period);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="payroll-${period}.xlsx"` });
    res.send(buf);
  }
  @Post('payroll/:period/generate') generate(@Param('period') period: string, @User() u: any) { return this.payroll.generate(period, u); }
  @Post('payroll/:period/approve') approve(@Param('period') period: string, @User() u: any) { return this.payroll.approve(period, u); }
  @Post('payroll/:period/reopen') reopen(@Param('period') period: string, @Body() b: any, @User() u: any) { return this.payroll.reopen(period, b, u); }
}

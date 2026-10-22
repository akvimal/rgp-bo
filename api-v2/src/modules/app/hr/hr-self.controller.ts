import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { HrSelfService, LeaveApprovalService } from './hr-self.service';

const Needs = (resource: string, action: string) => SetMetadata('hrself.needs', [resource, action]);

@Injectable()
export class HrSelfGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const [resource, action] = this.reflector.get<string[]>('hrself.needs', ctx.getHandler()) || ['myhr', 'view'];
    const req = ctx.switchToHttp().getRequest();
    if (!(await this.permissions.can(req.user?.roleid, resource, action))) throw new ForbiddenException('You are not allowed to do that here.');
    return true;
  }
}

/** A staff member's own HR: profile, pay slips, leave, attendance, staff credit. */
@ApiTags('My HR')
@Controller('my-hr')
@ApiBearerAuth()
@UseGuards(AuthGuard, HrSelfGuard)
export class HrSelfController {
  constructor(private readonly service: HrSelfService) {}

  @Get('summary') @Needs('myhr', 'view') summary(@User() u: any) { return this.service.summary(u); }
  @Get('profile') @Needs('myhr', 'view') profile(@User() u: any) { return this.service.profile(u); }
  @Put('profile') @Needs('myhr', 'view') updateProfile(@Body() b: any, @User() u: any) { return this.service.updateProfile(b, u); }
  @Get('payslips') @Needs('myhr', 'view') payslips(@User() u: any) { return this.service.payslips(u); }
  @Get('payslips/:id') @Needs('myhr', 'view') payslip(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.payslip(id, u); }
  @Get('leave') @Needs('myhr', 'view') leave(@Query('year') year: string, @User() u: any) { return this.service.leaveOverview(+year, u); }
  @Post('leave') @Needs('myhr', 'apply') apply(@Body() b: any, @User() u: any) { return this.service.applyLeave(b, u); }
  @Post('leave/:id/cancel') @Needs('myhr', 'apply') cancel(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.cancelLeave(id, u); }
  @Get('attendance') @Needs('myhr', 'view') attendance(@Query('period') period: string, @User() u: any) { return this.service.attendance(period, u); }
  @Get('credit') @Needs('myhr', 'view') credit(@User() u: any) { return this.service.credit(u); }
}

/** Leave requests waiting for the Business Head or the Store Head of the person's store. */
@ApiTags('Leave approvals')
@Controller('leave-approvals')
@ApiBearerAuth()
@UseGuards(AuthGuard, HrSelfGuard)
export class LeaveApprovalController {
  constructor(private readonly service: LeaveApprovalService) {}

  @Get('count') @Needs('leaveapprove', 'decide') count(@User() u: any) { return this.service.pendingCount(u); }
  @Get() @Needs('leaveapprove', 'decide') list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Post(':id/decision') @Needs('leaveapprove', 'decide') decide(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.decide(id, b, u); }
}

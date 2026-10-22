import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { StockAuditService } from './stock-audit.service';

/** the `stockaudit` action a handler needs (view / perform / manage), checked against the role's permissions */
const Needs = (action: string) => SetMetadata('stockaudit.action', action);

@Injectable()
export class StockAuditGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const action = this.reflector.get<string>('stockaudit.action', ctx.getHandler()) || 'view';
    const req = ctx.switchToHttp().getRequest();
    if (!(await this.permissions.can(req.user?.roleid, 'stockaudit', action))) throw new ForbiddenException('You are not allowed to do that with stock audits.');
    return true;
  }
}

@ApiTags('Stock audits')
@Controller('stock-audits')
@ApiBearerAuth()
@UseGuards(AuthGuard, StockAuditGuard)
export class StockAuditController {
  constructor(private readonly service: StockAuditService) {}

  @Get('options') @Needs('view') options(@User() u: any) { return this.service.options(u); }
  @Get('summary') @Needs('view') summary(@User() u: any) { return this.service.summary(u); }
  @Get('plans') @Needs('manage') plans(@User() u: any) { return this.service.plans(u); }
  @Post('plans') @Needs('manage') addPlan(@Body() b: any, @User() u: any) { return this.service.savePlan(null, b, u); }
  @Put('plans/:id') @Needs('manage') savePlan(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.savePlan(id, b, u); }
  @Post('generate') @Needs('manage') generate(@User() u: any) { return this.service.generate(u.id); }
  @Get() @Needs('view') list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Post(':id/skip') @Needs('manage') skip(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.skip(id, b, u); }
  @Post(':id/assign') @Needs('manage') assign(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.assign(id, b, u); }
}

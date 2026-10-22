import { Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { ExpenseService } from './expense.service';

/** the `expenses` action a handler needs (view / add / approve / manage), checked against the role's permissions */
const Needs = (action: string) => SetMetadata('expenses.action', action);

@Injectable()
export class ExpenseGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const action = this.reflector.get<string>('expenses.action', ctx.getHandler()) || 'view';
    const req = ctx.switchToHttp().getRequest();
    if (!(await this.permissions.can(req.user?.roleid, 'expenses', action))) throw new ForbiddenException('You are not allowed to do that with expenses.');
    return true;
  }
}

@ApiTags('Expenses')
@Controller('expenses')
@ApiBearerAuth()
@UseGuards(AuthGuard, ExpenseGuard)
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Get('policy') @Needs('view') policy(@User() u: any) { return this.service.policy(u); }
  @Get('categories') @Needs('view') categories() { return this.service.categories(); }
  @Post('categories') @Needs('manage') addCategory(@Body() b: any, @User() u: any) { return this.service.saveCategory(null, b, u); }
  @Put('categories/:id') @Needs('manage') saveCategory(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.saveCategory(id, b, u); }
  @Put('limit') @Needs('manage') limit(@Body() b: any, @User() u: any) { return this.service.setLimit(b?.limit, u); }

  @Get('recurring') @Needs('manage') recurring() { return this.service.recurring(); }
  @Post('recurring') @Needs('manage') addRecurring(@Body() b: any, @User() u: any) { return this.service.saveRecurring(null, b, u); }
  @Put('recurring/:id') @Needs('manage') saveRecurring(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.saveRecurring(id, b, u); }
  @Post('recurring/generate') @Needs('manage') generate(@Body() b: any, @User() u: any) { return this.service.generate(b?.period, u); }

  @Get('report') @Needs('approve') report(@Query() q: any, @User() u: any) { return this.service.report(q, u); }

  @Get() @Needs('view') list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Post() @Needs('add') raise(@Body() b: any, @User() u: any) { return this.service.raise(b, u); }
  @Put(':id') @Needs('add') update(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.update(id, b, u); }
  @Delete(':id') @Needs('add') remove(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.remove(id, u); }
  @Post(':id/decision') @Needs('approve') decide(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.decide(id, b, u); }
}

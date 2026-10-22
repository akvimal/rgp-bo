import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { VendorIssueService } from './vendor-issue.service';

/** the `vendorissues` action a handler needs (view / add / return / manage), checked against the role's permissions */
const Needs = (action: string) => SetMetadata('vendorissues.action', action);

@Injectable()
export class VendorIssueGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const action = this.reflector.get<string>('vendorissues.action', ctx.getHandler()) || 'view';
    const req = ctx.switchToHttp().getRequest();
    if (!(await this.permissions.can(req.user?.roleid, 'vendorissues', action))) throw new ForbiddenException('You are not allowed to do that with vendor issues.');
    return true;
  }
}

@ApiTags('Vendor issues')
@Controller('vendor-issues')
@ApiBearerAuth()
@UseGuards(AuthGuard, VendorIssueGuard)
export class VendorIssueController {
  constructor(private readonly service: VendorIssueService) {}

  @Get('options') @Needs('view') options(@User() u: any) { return this.service.options(u); }
  @Get('summary') @Needs('view') summary(@User() u: any) { return this.service.summary(u); }
  @Get('scorecard') @Needs('manage') scorecard(@User() u: any) { return this.service.scorecard(u); }
  @Get('invoices') @Needs('add') invoices(@Query('vendor_id', ParseIntPipe) vendorId: number) { return this.service.invoices(vendorId); }
  @Get('invoice-items') @Needs('add') invoiceItems(@Query('invoice_id', ParseIntPipe) invoiceId: number, @Query('store_id') storeId: string) { return this.service.invoiceItems(invoiceId, storeId ? +storeId : null); }
  @Get() @Needs('view') list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Get(':id') @Needs('view') get(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.get(id, u); }
  @Post() @Needs('add') create(@Body() b: any, @User() u: any) { return this.service.create(b, u); }
  @Put(':id') @Needs('add') update(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.update(id, b, u); }
  @Post(':id/notes') @Needs('add') note(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.addNote(id, b, u); }
  @Post(':id/send') @Needs('add') send(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.send(id, b, u); }
  @Post(':id/return') @Needs('return') sendBack(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.sendGoodsBack(id, u); }
  @Post(':id/cancel') @Needs('add') cancel(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.cancel(id, u); }
  @Post(':id/resolve') @Needs('manage') resolve(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.resolve(id, b, u); }
  @Post(':id/reject') @Needs('manage') reject(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.reject(id, b, u); }
  @Post(':id/reopen') @Needs('manage') reopen(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.reopen(id, u); }
}

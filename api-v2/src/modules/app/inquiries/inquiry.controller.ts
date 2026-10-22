import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { InquiryService } from './inquiry.service';

/** the `inquiries` action a handler needs (view / add / close / manage), checked against the role's permissions */
const Needs = (action: string) => SetMetadata('inquiries.action', action);

@Injectable()
export class InquiryGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const action = this.reflector.get<string>('inquiries.action', ctx.getHandler()) || 'view';
    const req = ctx.switchToHttp().getRequest();
    if (!(await this.permissions.can(req.user?.roleid, 'inquiries', action))) throw new ForbiddenException('You are not allowed to do that with inquiries.');
    return true;
  }
}

@ApiTags('Customer inquiries')
@Controller('inquiries')
@ApiBearerAuth()
@UseGuards(AuthGuard, InquiryGuard)
export class InquiryController {
  constructor(private readonly service: InquiryService) {}

  @Get('options') @Needs('view') options(@User() u: any) { return this.service.options(u); }
  @Get('summary') @Needs('view') summary(@User() u: any) { return this.service.summary(u); }
  @Get() @Needs('view') list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Post() @Needs('add') create(@Body() b: any, @User() u: any) { return this.service.create(b, u); }
  @Put(':id') @Needs('add') update(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.update(id, b, u); }
  @Post(':id/assign') @Needs('manage') assign(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.assign(id, b, u); }
  @Post(':id/close') @Needs('close') close(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.close(id, b, u); }
  @Post(':id/reopen') @Needs('manage') reopen(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.reopen(id, u); }
}

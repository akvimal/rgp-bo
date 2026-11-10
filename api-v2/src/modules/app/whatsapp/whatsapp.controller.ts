import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, Res, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { WhatsAppService } from './whatsapp.service';

const Needs = (action: string) => SetMetadata('whatsapp.action', action);

@Injectable()
export class WhatsAppGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const action = this.reflector.get<string>('whatsapp.action', ctx.getHandler()) || 'view';
    const req = ctx.switchToHttp().getRequest();
    // the number, token and switches are setup: they have their own permission (Settings > WhatsApp), apart from sending and reading the log
    const [resource, act] = action === 'settings' ? ['whatsappsettings', 'manage'] : ['whatsapp', action];
    if (!(await this.permissions.can(req.user?.roleid, resource, act))) throw new ForbiddenException('You are not allowed to do that with WhatsApp.');
    return true;
  }
}

@ApiTags('WhatsApp')
@Controller('whatsapp')
@ApiBearerAuth()
@UseGuards(AuthGuard, WhatsAppGuard)
export class WhatsAppController {
  constructor(private readonly service: WhatsAppService) {}

  @Get('settings') @Needs('view') settings(@Query('store_id', ParseIntPipe) storeId: number, @User() u: any) { return this.service.settings(u, storeId); }
  @Put('settings/:storeId') @Needs('settings') save(@Param('storeId', ParseIntPipe) storeId: number, @Body() b: any, @User() u: any) { return this.service.saveSettings(u, storeId, b); }
  @Post('test/:storeId') @Needs('settings') test(@Param('storeId', ParseIntPipe) storeId: number, @Body() b: any, @User() u: any) { return this.service.test(u, storeId, b?.mobile); }
  @Get('log') @Needs('view') log(@Query('store_id', ParseIntPipe) storeId: number, @Query('limit') limit: string, @User() u: any) { return this.service.recent(u, storeId, Number(limit) || 100); }

  @Get('bill/:saleId') @Needs('view') forSale(@Param('saleId', ParseIntPipe) id: number, @User() u: any) { return this.service.forSale(u, id); }
  @Post('bill/:saleId') @Needs('send') send(@Param('saleId', ParseIntPipe) id: number, @User() u: any) { return this.service.queueBill(u, id); }
  @Get('bill/:saleId/pdf') @Needs('view') async pdf(@Param('saleId', ParseIntPipe) id: number, @User() u: any, @Res() res: Response) {
    const f = await this.service.billPdf(u, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${f.filename}"`, 'Content-Length': String(f.data.length) });
    res.end(f.data);
  }
}

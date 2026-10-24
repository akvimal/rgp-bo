import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { OutageService } from './outage.service';

/**
 * The outage kit. Open to everyone who bills and to the people who run the shop (the `outage` permission): the weekly readiness record,
 * the printed price list and procedure, and the outage log. The price list carries no cost, so counter staff may print it.
 */
@ApiTags('Outage')
@Controller('outage')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class OutageController {
  constructor(private readonly outage: OutageService, private readonly permissions: PermissionService) {}

  private async assertKit(user: any) {
    if (!(await this.permissions.canUseOutageKit(user.roleid))) throw new ForbiddenException('The outage kit is not open to your role.');
  }

  private file(res: Response, f: { buffer: Buffer; filename: string; contentType: string }) {
    res.set({ 'Content-Type': f.contentType, 'Content-Disposition': `inline; filename="${f.filename}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(f.buffer);
  }

  @Get('status')
  async status(@Query('storeid') storeid: string, @User() user: any) {
    await this.assertKit(user);
    return this.outage.status(user.id, /^\d+$/.test(storeid ?? '') ? +storeid : null);
  }

  @Post('readiness')
  async readiness(@Body() body: any, @User() user: any) {
    await this.assertKit(user);
    return this.outage.saveReadiness(user.id, body);
  }

  @Get('price-list')
  async priceList(@Query('format') format: string, @User() user: any, @Res({ passthrough: true }) res: Response) {
    await this.assertKit(user);
    return this.file(res, await this.outage.priceList(user.id, format === 'xlsx' ? 'xlsx' : 'pdf'));
  }

  @Get('procedure')
  async procedure(@User() user: any, @Res({ passthrough: true }) res: Response) {
    await this.assertKit(user);
    return this.file(res, await this.outage.procedure(user.id));
  }

  @Post('events')
  async addEvent(@Body() body: any, @User() user: any) {
    await this.assertKit(user);
    return this.outage.addEvent(user.id, body);
  }

  @Put('events/:id')
  async updateEvent(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) {
    await this.assertKit(user);
    return this.outage.updateEvent(user.id, id, body);
  }
}

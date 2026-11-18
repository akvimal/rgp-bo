import { Controller, ForbiddenException, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { OutageService } from './outage.service';

/**
 * The printed documents: the price list and the outage procedure. Open to everyone who bills, to the people who run the shop and to anyone with
 * Products or Checklists (the old `outage` permission still counts). The price list carries no cost, so counter staff may print it.
 */
@ApiTags('Outage')
@Controller('outage')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class OutageController {
  constructor(private readonly outage: OutageService, private readonly permissions: PermissionService) {}

  private async assertKit(user: any) {
    if (!(await this.permissions.canUseOutageKit(user.roleid))) throw new ForbiddenException('Printing the price list is not open to your role.');
  }

  private file(res: Response, f: { buffer: Buffer; filename: string; contentType: string }) {
    res.set({ 'Content-Type': f.contentType, 'Content-Disposition': `inline; filename="${f.filename}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(f.buffer);
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
}

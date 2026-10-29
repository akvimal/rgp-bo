import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { GstRegisterService } from './gst-register.service';

/** The sales register, HSN summary, monthly summary and the Excel for the auditor. For the people who run the business. */
@ApiTags('GST register')
@Controller('gst')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GstRegisterController {
  constructor(private readonly register: GstRegisterService, private readonly permissions: PermissionService) {}

  private async assertAllowed(user: any) {
    if (!(await this.permissions.canUseGstFiling(user.roleid))) throw new ForbiddenException('GST is for the Business Head.');
  }

  private file(res: Response, f: { buffer: Buffer; filename: string; contentType: string }) {
    res.set({ 'Content-Type': f.contentType, 'Content-Disposition': `attachment; filename="${f.filename}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(f.buffer);
  }

  @Get('sales-register') async list(@Query('month') month: string, @Query('store') store: string, @User() u: any) { await this.assertAllowed(u); return this.register.register(u, month, store); }
  @Get('sales-register/xlsx') async xlsx(@Query('month') month: string, @User() u: any, @Res({ passthrough: true }) res: Response) { await this.assertAllowed(u); return this.file(res, await this.register.salesXlsx(u, month)); }
  @Get('hsn-summary') async hsn(@Query('month') month: string, @User() u: any) { await this.assertAllowed(u); return this.register.hsn(u, month); }
  @Get('monthly-summary') async summary(@Query('month') month: string, @User() u: any) { await this.assertAllowed(u); return this.register.summary(u, month); }
  @Get('pack') async pack(@Query('month') month: string, @User() u: any, @Res({ passthrough: true }) res: Response) { await this.assertAllowed(u); return this.file(res, await this.register.pack(u, month)); }
  @Get('months') async months(@User() u: any) { await this.assertAllowed(u); return this.register.months(u); }
  @Post('months/:month/close') async close(@Param('month') month: string, @Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.register.close(u, month, b); }
  @Post('months/:month/reopen') async reopen(@Param('month') month: string, @Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.register.reopen(u, month, b); }
}

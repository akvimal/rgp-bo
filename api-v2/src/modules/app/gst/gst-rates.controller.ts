import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { GstRatesService } from './gst-rates.service';

/** GST rate changes and the HSN of products. For the people who run the business. */
@ApiTags('GST rates')
@Controller('gst')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GstRatesController {
  constructor(private readonly rates: GstRatesService, private readonly permissions: PermissionService) {}

  private async assertAllowed(user: any) {
    if (!(await this.permissions.canUseGstFiling(user.roleid))) throw new ForbiddenException('GST is for the Business Head.');
  }

  @Get('rate-changes') async list(@User() u: any) { await this.assertAllowed(u); return this.rates.list(); }
  @Post('rate-changes/preview') async preview(@Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.rates.preview(b); }
  @Post('rate-changes') async create(@Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.rates.create(u, b); }
  @Delete('rate-changes/:id') async cancel(@Param('id', ParseIntPipe) id: number, @User() u: any) { await this.assertAllowed(u); return this.rates.cancel(u, id); }
  @Get('rate-changes/:id/report') async report(@Param('id', ParseIntPipe) id: number, @User() u: any) { await this.assertAllowed(u); return this.rates.report(id); }

  @Get('hsn/missing') async missing(@User() u: any) { await this.assertAllowed(u); return this.rates.missingHsn(); }
  @Put('hsn/products') async setHsn(@Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.rates.setHsn(u, b); }
  @Put('hsn/category') async setCategory(@Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.rates.setCategoryHsn(u, b); }
  @Post('hsn/category/apply') async applyCategory(@Body() b: any, @User() u: any) { await this.assertAllowed(u); return this.rates.applyCategoryHsn(u, b); }
}

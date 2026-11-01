import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from 'src/modules/app/roles/permission.service';
import { DrugRegisterService } from './drug-register.service';

/**
 * The drug register (pharmacy pack). Its endpoints answer 403 for a business that has not got the module (the gate on the /schedule path).
 * The counter needs no permission to write it: it is written through the bill. Reading and printing are for the people who run the shop.
 */
@ApiTags('Drug register')
@Controller('schedule')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class DrugRegisterController {
  constructor(private readonly register: DrugRegisterService, private readonly permissions: PermissionService) {}

  private async assertReader(user: any) {
    if (!(await this.permissions.canViewDrugRegister(user.roleid))) throw new ForbiddenException('The drug register is for the people who run the shop.');
  }

  private file(res: Response, f: { buffer: Buffer; filename: string; contentType: string }) {
    res.set({ 'Content-Type': f.contentType, 'Content-Disposition': `inline; filename="${f.filename}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(f.buffer);
  }

  /** what the counter needs: which schedules need details on a bill */
  @Get('config') config() { return this.register.config(); }
  @Get('prescribers') prescribers(@Query('q') q: string, @User() u: any) { return this.register.prescribers(u, q); }
  /** what is already on record for a customer: prescriptions kept with them and the patient and prescriber of their last supplies */
  @Get('customer/:id/context') customerContext(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.register.customerContext(u, id); }

  @Get('register') async list(@Query() q: any, @User() u: any) { await this.assertReader(u); return this.register.register(u, q); }
  @Get('register/pdf') async pdf(@Query() q: any, @User() u: any, @Res({ passthrough: true }) res: Response) { await this.assertReader(u); return this.file(res, await this.register.pdf(u, q)); }
  @Get('register/xlsx') async xlsx(@Query() q: any, @User() u: any, @Res({ passthrough: true }) res: Response) { await this.assertReader(u); return this.file(res, await this.register.xlsx(u, q)); }
  @Get('coverage') async coverage(@User() u: any) { await this.assertReader(u); return this.register.coverage(u); }
  /** how the scheduled supplies of a period were covered, by schedule and by the person who made the sale */
  @Get('coverage-report') async coverageReport(@Query() q: any, @User() u: any) { await this.assertReader(u); return this.register.coverageReport(u, q); }
  /** the patient and the prescriber for a bill that was completed without them */
  @Post('sales/:id/details') async addDetails(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { await this.assertReader(u); return this.register.addDetails(u, id, b); }
}

import { Controller, ForbiddenException, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
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

  @Get('register') async list(@Query() q: any, @User() u: any) { await this.assertReader(u); return this.register.register(u, q); }
  @Get('register/pdf') async pdf(@Query() q: any, @User() u: any, @Res({ passthrough: true }) res: Response) { await this.assertReader(u); return this.file(res, await this.register.pdf(u, q)); }
  @Get('register/xlsx') async xlsx(@Query() q: any, @User() u: any, @Res({ passthrough: true }) res: Response) { await this.assertReader(u); return this.file(res, await this.register.xlsx(u, q)); }
  @Get('coverage') async coverage(@User() u: any) { await this.assertReader(u); return this.register.coverage(u); }
}

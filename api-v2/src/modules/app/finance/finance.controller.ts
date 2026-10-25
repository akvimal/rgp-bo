import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { FinanceService } from './finance.service';

/** a statement is read in memory and not kept: only the lines parsed from it are */
const upload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * Finance: the bank accounts, statements, reconciliation, income and expenses, and the records check. Only the Business Head and the Owner-operator:
 * a bank statement is the most sensitive record the business has.
 */
@ApiTags('Finance')
@Controller('finance')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService, private readonly permissions: PermissionService) {}

  private async assertFinance(user: any) {
    if (!(await this.permissions.canUseFinance(user.roleid))) throw new ForbiddenException('Finance is for the Business Head.');
  }

  @Get('accounts') async accounts(@User() u: any) { await this.assertFinance(u); return this.finance.accounts(u); }
  @Post('accounts') async addAccount(@Body() b: any, @User() u: any) { await this.assertFinance(u); return this.finance.saveAccount(u, null, b); }
  @Put('accounts/:id') async saveAccount(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { await this.assertFinance(u); return this.finance.saveAccount(u, id, b); }
  @Get('accounts/:id/imports') async imports(@Param('id', ParseIntPipe) id: number, @User() u: any) { await this.assertFinance(u); return this.finance.imports(u, id); }

  @Post('accounts/:id/preview') @UseInterceptors(upload)
  async preview(@Param('id', ParseIntPipe) id: number, @UploadedFile() f: any, @Body('mapping') mapping: string, @User() u: any) { await this.assertFinance(u); return this.finance.preview(u, id, f, mapping); }

  @Post('accounts/:id/import') @UseInterceptors(upload)
  async importFile(@Param('id', ParseIntPipe) id: number, @UploadedFile() f: any, @Body('mapping') mapping: string, @User() u: any) { await this.assertFinance(u); return this.finance.importFile(u, id, f, mapping); }

  @Get('lines') async lines(@Query() q: any, @User() u: any) { await this.assertFinance(u); return this.finance.lines(u, q); }
  @Put('lines/:id') async tag(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { await this.assertFinance(u); return this.finance.tagLine(u, id, b); }
  @Get('rules') async rules(@User() u: any) { await this.assertFinance(u); return this.finance.rules(u); }
  @Delete('rules/:id') async removeRule(@Param('id', ParseIntPipe) id: number, @User() u: any) { await this.assertFinance(u); return this.finance.removeRule(u, id); }

  @Get('reconcile') async month(@Query('account') account: string, @Query('month') month: string, @User() u: any) { await this.assertFinance(u); return this.finance.month(u, +account, month); }
  @Get('reconcile/signed') async signed(@Query('account') account: string, @User() u: any) { await this.assertFinance(u); return this.finance.signedMonths(u, +account); }
  @Post('reconcile/signoff') async signoff(@Body() b: any, @User() u: any) { await this.assertFinance(u); return this.finance.signoff(u, +b?.account, b?.month, b); }
  @Post('reconcile/reopen') async reopen(@Body() b: any, @User() u: any) { await this.assertFinance(u); return this.finance.reopen(u, +b?.account, b?.month, b); }

  @Get('overview') async overview(@Query() q: any, @User() u: any) { await this.assertFinance(u); return this.finance.overview(u, q); }
  @Get('records') async records(@User() u: any) { await this.assertFinance(u); return this.finance.records(u); }
  @Post('records/attest') async attest(@Body() b: any, @User() u: any) { await this.assertFinance(u); return this.finance.attest(u, b); }
}

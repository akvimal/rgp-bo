import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PurchasingGuard } from '../../roles/purchasing.guard';
import { InvoiceScanService } from './invoice-scan.service';

/** The lines read from a scanned invoice copy, saved with the draft and checked one at a time. */
@ApiTags('PurchaseInvoices')
@Controller('purchases/:id/scan')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class InvoiceScanController {
  constructor(private readonly scan: InvoiceScanService) {}

  @Get()
  get(@Param('id', ParseIntPipe) id: number) { return this.scan.get(id); }

  @Put()
  replace(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() u: any) { return this.scan.replace(id, body, u.id); }

  @Post('verify-all')
  verifyAll(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.scan.verifyAll(id, u.id); }

  @Put('lines/:lineId')
  saveLine(@Param('id', ParseIntPipe) id: number, @Param('lineId', ParseIntPipe) lineId: number, @Body() body: any, @User() u: any) { return this.scan.saveLine(id, lineId, body, u.id); }

  @Post('lines/:lineId/verify')
  verify(@Param('id', ParseIntPipe) id: number, @Param('lineId', ParseIntPipe) lineId: number, @User() u: any) { return this.scan.verify(id, lineId, u.id); }

  @Post('lines/:lineId/unverify')
  unverify(@Param('id', ParseIntPipe) id: number, @Param('lineId', ParseIntPipe) lineId: number, @User() u: any) { return this.scan.unverify(id, lineId, u.id); }

  @Post('lines/:lineId/discard')
  discard(@Param('id', ParseIntPipe) id: number, @Param('lineId', ParseIntPipe) lineId: number, @Body() body: any, @User() u: any) { return this.scan.discard(id, lineId, body?.reason, u.id); }

  @Post('lines/:lineId/restore')
  restore(@Param('id', ParseIntPipe) id: number, @Param('lineId', ParseIntPipe) lineId: number, @User() u: any) { return this.scan.restore(id, lineId, u.id); }
}

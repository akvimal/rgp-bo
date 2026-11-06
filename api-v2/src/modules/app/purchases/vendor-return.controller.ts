import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { PurchasingGuard } from '../roles/purchasing.guard';
import { User } from 'src/core/decorator/user.decorator';
import { VendorReturnService } from './vendor-return.service';

@ApiTags('VendorReturns')
@Controller('vendor-returns')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class VendorReturnController {
  constructor(private service: VendorReturnService) {}

  @Get()
  list(@Query() q: any) { return this.service.list(q); }

  /** batches of the vendor's goods in stock at a store that can go back */
  @Get('returnable')
  returnable(@Query('vendor', ParseIntPipe) vendor: number, @Query('store', ParseIntPipe) store: number, @Query('q') q: string) {
    return this.service.returnable(vendor, store, q);
  }

  /** the returns open for an invoice's vendor, and those already adjusted on the invoice */
  @Get('invoice/:invoiceid')
  forInvoice(@Param('invoiceid', ParseIntPipe) invoiceid: number) { return this.service.creditsFor(invoiceid); }

  @Post('invoice/:invoiceid')
  addCredit(@Param('invoiceid', ParseIntPipe) invoiceid: number, @Body() body: any, @User() u: any) {
    return this.service.addCredit(invoiceid, Number(body?.returnid), body?.amount, u.id);
  }

  @Delete('invoice/:invoiceid/:creditid')
  removeCredit(@Param('invoiceid', ParseIntPipe) invoiceid: number, @Param('creditid', ParseIntPipe) creditid: number, @User() u: any) {
    return this.service.removeCredit(invoiceid, creditid, u.id);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) { return this.service.get(id); }

  @Post()
  create(@Body() body: any, @User() u: any) { return this.service.create(body, u.id); }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() u: any) { return this.service.cancel(id, body?.note, u.id); }
}

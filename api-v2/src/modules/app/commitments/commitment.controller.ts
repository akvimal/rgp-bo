import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from 'src/core/decorator/user.decorator';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { CommitmentService } from './commitment.service';

/** Customer commitments: orders taken at the counter and paid in advance (see CommitmentService). */
@ApiTags('Customer commitments')
@Controller('commitments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CommitmentController {
  constructor(private readonly commitments: CommitmentService) {}

  @Get()
  list(@Query() query: any, @User() user: any) { return this.commitments.list(query, user); }

  @Get('settings')
  async settings() { return { holddays: await this.commitments.holdDays() }; }

  /** the customer's commitments that are ready to collect: the till offers them */
  @Get('ready/:customerid')
  ready(@Param('customerid', ParseIntPipe) customerid: number, @Query('storeid') storeid: string, @User() user: any) {
    return this.commitments.readyFor(customerid, storeid ? Number(storeid) : null, user);
  }

  /** who is waiting for a product, so purchasing can link them to a request */
  @Get('waiting/:productid')
  waiting(@Param('productid', ParseIntPipe) productid: number, @Query('storeid') storeid: string, @User() user: any) {
    return this.commitments.waitingFor(productid, storeid ? Number(storeid) : null, user);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.commitments.get(id, user); }

  @Post()
  create(@Body() body: any, @User() user: any) { return this.commitments.create(body, user); }

  @Post(':id/payments')
  pay(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.commitments.addPayment(id, body, user); }

  @Post(':id/refund')
  refund(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.commitments.refund(id, body, user); }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.commitments.cancel(id, body, user); }

  @Post(':id/notified')
  notified(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.commitments.notify(id, body, user); }

  @Post(':id/requests')
  requests(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.commitments.raiseRequests(id, user); }

  @Post('lines/:lineid/link')
  link(@Param('lineid', ParseIntPipe) lineid: number, @Body() body: any, @User() user: any) { return this.commitments.linkLine(lineid, body, user); }
}

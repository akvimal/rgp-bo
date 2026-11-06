import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from 'src/core/decorator/user.decorator';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { CustomerDueService } from './customer-due.service';

/** What customers owe for bills left to pay later (see CustomerDueService). */
@ApiTags('Customer dues')
@Controller('customer-dues')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CustomerDueController {
  constructor(private readonly dues: CustomerDueService) {}

  /** everyone who owes, the overdue first */
  @Get('owing/all')
  list() { return this.dues.list(); }

  /** the figures the till needs for a customer: limit, balance, what is left to use, anything overdue */
  @Get(':id/brief')
  brief(@Param('id', ParseIntPipe) id: number) { return this.dues.brief(id); }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) { return this.dues.get(id); }

  @Put(':id/limit')
  limit(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.dues.setLimit(id, body, user); }

  @Post(':id/payment')
  pay(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.dues.collect(id, body, user); }

  @Post(':id/adjustment')
  adjust(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.dues.adjust(id, body, user); }
}

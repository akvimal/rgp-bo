import { Body, Controller, Get, ParseIntPipe, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { StaffCreditService } from './staff-credit.service';

@ApiTags('Staff credit')
@Controller('staff-credit')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StaffCreditController {
  constructor(private readonly service: StaffCreditService) {}

  /** for the counter: who a bill can go on and what is left of their limit (names only, no balances) */
  @Get('options')
  options() {
    return this.service.options();
  }

  @Get('summary')
  async summary(@Query('period') period: string, @User() user: any) {
    await this.service.assertBusinessHead(user);
    return this.service.summary(period || new Date().toISOString().slice(0, 7));
  }

  @Get(':userId/entries')
  async entries(@Param('userId', ParseIntPipe) userId: number, @User() user: any) {
    await this.service.assertBusinessHead(user);
    return this.service.entries(userId);
  }

  @Put(':userId/cap')
  async cap(@Param('userId', ParseIntPipe) userId: number, @Body() body: any, @User() user: any) {
    await this.service.assertBusinessHead(user);
    return this.service.setCap(userId, body?.cap, user);
  }

  @Post(':userId/recovery')
  async recovery(@Param('userId', ParseIntPipe) userId: number, @Body() body: any, @User() user: any) {
    await this.service.assertBusinessHead(user);
    return this.service.recover(userId, body, user);
  }

  @Post(':userId/adjustment')
  async adjustment(@Param('userId', ParseIntPipe) userId: number, @Body() body: any, @User() user: any) {
    await this.service.assertBusinessHead(user);
    return this.service.adjust(userId, body, user);
  }
}

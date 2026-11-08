import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { InsightsService } from './insights.service';

/**
 * Insights for the people who run the shop: ask a question, the buying brief and stock that will not sell in time, the weekly owner summary and staff
 * coaching notes. Who may use each is decided in the service (the Business Head, or a Store Head for their own stores); a person's own notes are open to them.
 */
@ApiTags('Insights')
@Controller('insights')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  // ---- ask the shop
  @Get('ask/reports')
  catalogue(@User() user: any) { return this.service.catalogue(user); }

  @Post('ask/run')
  @HttpCode(200)
  run(@Body() body: any, @User() user: any) { return this.service.runReport(user, body); }

  @Post('ask')
  @HttpCode(200)
  ask(@Body() body: any, @User() user: any) { return this.service.ask(user, body?.question); }

  // ---- buying
  @Get('expiry-risk')
  expiryRisk(@Query() q: any, @User() user: any) { return this.service.expiryRisk(user, q); }

  @Post('buying-brief')
  @HttpCode(200)
  brief(@Body() body: any, @User() user: any) { return this.service.buyingBrief(user, body); }

  // ---- the weekly summary
  @Get('weekly')
  weekly(@User() user: any) { return this.service.weeklyList(user); }

  @Post('weekly/generate')
  @HttpCode(200)
  generate(@Body() body: any, @User() user: any) { return this.service.generateWeekly(user, { force: body?.force === true }); }

  @Post('weekly/send')
  @HttpCode(200)
  send(@Body() body: any, @User() user: any) { return this.service.sendWeekly(user, body?.id ? Number(body.id) : undefined); }

  @Put('weekly/telegram')
  weeklyTelegram(@Body() body: any, @User() user: any) { return this.service.setWeeklyTelegram(user, body?.on !== false && body?.on !== 'off'); }

  // ---- coaching
  @Get('coaching/mine')
  mine(@User() user: any) { return this.service.myCoaching(user); }

  @Get('coaching')
  people(@Query() q: any, @User() user: any) { return this.service.coachingPeople(user, q); }

  @Get('coaching/:id')
  coaching(@Param('id', ParseIntPipe) id: number, @Query() q: any, @User() user: any) { return this.service.coaching(user, id, q); }

  @Post('coaching/:id/draft')
  @HttpCode(200)
  draft(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.service.draftCoaching(user, id, body); }

  @Put('coaching/:id')
  save(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.service.saveCoaching(user, id, body); }
}

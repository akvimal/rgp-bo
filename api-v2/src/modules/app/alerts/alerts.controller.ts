import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { AlertsService } from './alerts.service';

/** The notification list and the language are every person's own; setting up the rules is the owner's (checked in the service). */
@ApiTags('Alerts')
@Controller('alerts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get('notifications')
  notifications(@Query('status') status: string, @Query('limit') limit: string, @User() user: any) {
    return this.service.list(user, { status, limit: limit ? +limit : undefined });
  }

  @Post('notifications/read-all')
  readAll(@User() user: any) { return this.service.readAll(user); }

  @Post('notifications/:id/read')
  read(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.service.read(user, id); }

  @Post('notifications/:id/dismiss')
  dismiss(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.service.dismiss(user, id); }

  @Post('notifications/:id/snooze')
  snooze(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.service.snooze(user, id, body?.hours); }

  @Get('prefs')
  prefs(@User() user: any) { return this.service.prefs(user); }

  @Put('prefs')
  savePrefs(@Body() body: any, @User() user: any) { return this.service.savePrefs(user, body); }

  @Get('kinds')
  kinds() { return this.service.kinds(); }

  @Get('rules')
  rules(@User() user: any) { return this.service.rules(user); }

  @Post('rules')
  create(@Body() body: any, @User() user: any) { return this.service.createRule(user, body); }

  @Post('rules/preview')
  preview(@Body() body: any, @User() user: any) { return this.service.preview(user, body); }

  @Post('rules/draft')
  draft(@Body() body: any, @User() user: any) { return this.service.draft(user, body); }

  @Put('rules/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.service.updateRule(user, id, body); }

  @Delete('rules/:id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.service.removeRule(user, id); }

  @Post('run')
  run(@User() user: any) { return this.service.runFor(user); }
}

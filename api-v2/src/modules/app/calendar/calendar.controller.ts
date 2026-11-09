import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { CalendarService } from './calendar.service';

/** The calendar: a read-only view of what is dated across the app. Each kind is shown only to those who may see it on its own screen. */
@ApiTags('Calendar')
@Controller('calendar')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  private async need(user: any) {
    if (!(await this.calendar.can(user.roleid, 'calendar', 'view'))) throw new ForbiddenException('The calendar is not open to your role.');
  }

  @Get('options')
  async options(@User() user: any) {
    await this.need(user);
    return this.calendar.options(user);
  }

  @Get('leave-cover')
  async leaveCover(@Query('from') from: string, @Query('to') to: string, @User() user: any) {
    await this.need(user);
    return this.calendar.leaveCover(user, { from, to });
  }

  @Get()
  async entries(@Query('from') from: string, @Query('to') to: string, @Query('store') store: string, @Query('types') types: string, @User() user: any) {
    await this.need(user);
    return this.calendar.entries(user, { from, to, store, types });
  }
}

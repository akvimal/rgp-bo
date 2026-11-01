import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { MessagingService } from './messaging.service';

/** Alerts sent outside the app. A person connects and tunes their own Telegram; the owner sees how alerts are being sent (checked in the service). */
@ApiTags('Messaging')
@Controller('messaging')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @Get('telegram/me')
  me(@User() user: any) { return this.service.me(user); }

  @Post('telegram/link')
  link(@User() user: any) { return this.service.link(user); }

  @Put('telegram/me')
  savePrefs(@Body() body: any, @User() user: any) { return this.service.savePrefs(user, body); }

  @Delete('telegram/me')
  unlink(@User() user: any) { return this.service.unlink(user); }

  @Post('telegram/test')
  test(@User() user: any) { return this.service.test(user); }

  @Get('overview')
  overview(@User() user: any) { return this.service.overview(user); }

  @Put('overview/enabled')
  enabled(@Body() body: any, @User() user: any) { return this.service.setEnabled(user, body?.on !== false && body?.on !== 'off'); }
}

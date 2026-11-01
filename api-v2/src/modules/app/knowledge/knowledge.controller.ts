import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { KnowledgeService } from './knowledge.service';

/** The weekly knowledge check. Everyone signed in takes their own; the team results are for the people who run the shop (checked in the service). */
@ApiTags('Knowledge check')
@Controller('knowledge')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get('me') me(@User() user: any) { return this.service.me(user); }

  @Post('start') start(@Body() body: any, @User() user: any) { return this.service.start(user, !!body?.practice); }

  @Post(':id/answer') answer(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.service.answer(user, id, String(body?.question ?? ''), Number(body?.choice)); }

  @Post(':id/finish') finish(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.service.finish(user, id); }

  @Get('team') team(@User() user: any) { return this.service.team(user); }
}

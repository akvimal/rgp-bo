import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { FeedbackService } from './feedback.service';

/** App feedback: report something wrong, ask a question, suggest a feature, and read the answer. Managers (feedback.manage) work the inbox. */
@ApiTags('Feedback')
@Controller('feedback')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  private async need(user: any) {
    if (!(await this.feedback.can(user.roleid, 'add'))) throw new ForbiddenException('Help and feedback is not open to your role.');
  }

  @Get('options')
  async options(@User() user: any) { await this.need(user); return this.feedback.options(user); }

  @Get('mine')
  async mine(@User() user: any) { await this.need(user); return this.feedback.mine(user); }

  @Get('inbox')
  async inbox(@Query('view') view: string, @Query('kind') kind: string, @Query('module') module: string, @Query('q') q: string, @User() user: any) {
    await this.need(user);
    return this.feedback.inbox(user, { view, kind, module, q });
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number, @User() user: any) { await this.need(user); return this.feedback.get(user, id); }

  @Post()
  async create(@Body() body: any, @User() user: any) { await this.need(user); return this.feedback.create(user, body); }

  @Post(':id/reply')
  async reply(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { await this.need(user); return this.feedback.reply(user, id, body); }

  @Post(':id/status')
  async status(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { await this.need(user); return this.feedback.setStatus(user, id, body); }

  @Post(':id/assign')
  async assign(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { await this.need(user); return this.feedback.assign(user, id, body); }

  @Post(':id/close')
  async close(@Param('id', ParseIntPipe) id: number, @User() user: any) { await this.need(user); return this.feedback.close(user, id); }

  @Post(':id/reopen')
  async reopen(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { await this.need(user); return this.feedback.reopen(user, id, body); }
}

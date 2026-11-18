import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { ChecklistsService } from './checklists.service';

const sid = (v: string) => (/^\d+$/.test(v ?? '') ? +v : null);

/**
 * Store checklists (run a list, change a store's lists) and the system's weekly and monthly tasks (switch on or off, move to another day).
 * Who may do what is decided in the service: everyone with the page may run a list; changing lists and tasks needs the `checklistsetup` permission (Settings > Checklists).
 */
@ApiTags('Checklists')
@Controller('checklists')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Get()
  overview(@Query('storeid') storeid: string, @User() user: any) { return this.checklists.overview(user, sid(storeid)); }

  @Get('tasks')
  tasks(@Query('storeid') storeid: string, @User() user: any) { return this.checklists.tasks(user, sid(storeid)); }

  @Put('tasks/:key')
  saveTask(@Param('key') key: string, @Body() body: any, @User() user: any) { return this.checklists.saveTask(user, key, body); }

  @Delete('tasks/:key')
  resetTask(@Param('key') key: string, @Query('storeid') storeid: string, @User() user: any) { return this.checklists.resetTask(user, key, storeid); }

  @Put('order')
  saveOrder(@Body() body: any, @User() user: any) { return this.checklists.saveOrder(user, body); }

  @Delete('order')
  resetOrder(@Query() q: { storeid?: string; scope?: string }, @User() user: any) { return this.checklists.resetOrder(user, q); }

  @Post()
  add(@Body() body: any, @User() user: any) { return this.checklists.addList(user, body); }

  @Get(':key/history')
  history(@Param('key') key: string, @Query('storeid') storeid: string, @User() user: any) { return this.checklists.history(user, key, sid(storeid)); }

  @Post(':key/run')
  run(@Param('key') key: string, @Body() body: any, @User() user: any) { return this.checklists.run(user, key, body); }

  @Put(':key')
  save(@Param('key') key: string, @Body() body: any, @User() user: any) { return this.checklists.saveList(user, key, body); }

  @Delete(':key')
  reset(@Param('key') key: string, @Query() q: { storeid?: string; scope?: string }, @User() user: any) { return this.checklists.resetList(user, key, q); }
}

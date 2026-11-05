import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { TodoService } from './todo.service';

/** The to-do list: your own, a store's pool, and (for a manager) the ones you give to others. The reminders are alerts of kind todo_due. */
@ApiTags('Todos')
@Controller('todos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class TodoController {
  constructor(private readonly todos: TodoService) {}

  private async need(user: any, action: 'view' | 'add') {
    if (!(await this.todos.can(user.roleid, action))) throw new ForbiddenException('The to-do list is not open to your role.');
  }

  @Get()
  async list(@Query('scope') scope: string, @Query('status') status: string, @User() user: any) {
    await this.need(user, 'view');
    return this.todos.list(user, { scope, status });
  }

  @Get('options')
  async options(@User() user: any) {
    await this.need(user, 'view');
    return this.todos.optionsFor(user);
  }

  @Get('repeats')
  async repeats(@User() user: any) {
    await this.need(user, 'view');
    return this.todos.repeats(user);
  }

  @Delete('repeats/:id')
  async stopRepeat(@Param('id') id: string, @User() user: any) {
    await this.need(user, 'add');
    return this.todos.stopRepeat(user, +id);
  }

  @Post()
  async create(@Body() body: any, @User() user: any) {
    await this.need(user, 'add');
    return this.todos.create(user, body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @User() user: any) {
    await this.need(user, 'add');
    return this.todos.update(user, +id, body);
  }

  @Post(':id/done')
  async done(@Param('id') id: string, @Body() body: any, @User() user: any) {
    await this.need(user, 'view');
    return this.todos.done(user, +id, body);
  }

  @Post(':id/reopen')
  async reopen(@Param('id') id: string, @User() user: any) {
    await this.need(user, 'view');
    return this.todos.reopen(user, +id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @User() user: any) {
    await this.need(user, 'add');
    return this.todos.remove(user, +id);
  }
}

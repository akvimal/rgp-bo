import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { CounterGuideService } from './counter-guide.service';

/**
 * The Counter guide. The counter side (the approved cards and the advice) is open to anyone signed in: it holds no cost and no customer data, and only approved
 * cards are ever returned. Writing and approving cards need the counterguide permission (the service checks).
 */
@ApiTags('Counter guide')
@Controller('counter-guide')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CounterGuideController {
  constructor(private readonly service: CounterGuideService) {}

  @Get('cards') cards() { return this.service.cards(); }

  @Post('advise') advise(@Body() body: any) { return this.service.advise(body); }

  @Get('admin/cards') adminList(@User() user: any) { return this.service.adminList(user); }
  @Post('admin/cards') add(@User() user: any, @Body() body: any) { return this.service.save(user, null, body); }
  @Put('admin/cards/:id') edit(@User() user: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.save(user, id, body); }
  @Post('admin/cards/:id/approve') approve(@User() user: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.approve(user, id, body?.version); }
  @Post('admin/cards/:id/retire') retire(@User() user: any, @Param('id', ParseIntPipe) id: number) { return this.service.retire(user, id); }
  @Delete('admin/cards/:id') remove(@User() user: any, @Param('id', ParseIntPipe) id: number) { return this.service.remove(user, id); }
  @Post('admin/seed') seed(@User() user: any) { return this.service.seedStarter(user); }
}

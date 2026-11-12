import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { DisposalService } from './disposal.service';

/** Out-passes for goods that leave the shop as waste, and the expiry list they start from. Who may do what is decided in the service (by role and store). */
@ApiTags('Disposal')
@Controller('disposal')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class DisposalController {
  constructor(private readonly service: DisposalService) {}

  /** the batches of a store that are expired or near expiry, with what is held and whether the vendor takes them back */
  @Get('expiry') expiry(@Query() q: any, @User() u: any) { return this.service.expiry(q, u); }
  @Get('witnesses') witnesses(@Query() q: any, @User() u: any) { return this.service.witnesses(q, u); }

  @Get() list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Post() create(@Body() b: any, @User() u: any) { return this.service.create(b, u); }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @User() u: any, @Res() res: Response) {
    const f = await this.service.pdf(id, u);
    res.setHeader('Content-Disposition', `attachment; filename=${f.name}`);
    res.type('application/pdf');
    return res.send(f.buffer);
  }

  @Get(':id') get(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.get(id, u); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.update(id, b, u); }
  @Post(':id/approve') approve(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.approve(id, u); }
  @Post(':id/reject') reject(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.reject(id, b, u); }
  @Post(':id/cancel') cancel(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.cancel(id, b, u); }
  @Post(':id/confirm') confirm(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.confirm(id, b, u); }
}

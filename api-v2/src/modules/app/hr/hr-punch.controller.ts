import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, Query, Req, Res, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { HrSelfGuard } from './hr-self.controller';
import { AttendanceReviewService, PunchService } from './hr-punch.service';

const Needs = (resource: string, action: string) => SetMetadata('hrself.needs', [resource, action]);

/** The punch screen of a registered store PC. */
@ApiTags('Attendance punch')
@Controller('punch')
@ApiBearerAuth()
@UseGuards(AuthGuard, HrSelfGuard)
export class PunchController {
  constructor(private readonly service: PunchService) {}

  @Get('staff') @Needs('attendpunch', 'use') staff(@Req() r: Request, @Headers('x-device-token') token?: string) { return this.service.staff(token, r.ip); }
  @Post() @Needs('attendpunch', 'use') punch(@Body() b: any, @Req() r: Request, @Headers('x-device-token') token?: string) { return this.service.punch(b, token, r.ip); }
}

/** Managers: review each day's punches and photos, correct days, set PINs. */
@ApiTags('Attendance review')
@Controller('attendance-review')
@ApiBearerAuth()
@UseGuards(AuthGuard, HrSelfGuard)
export class AttendanceReviewController {
  constructor(private readonly service: AttendanceReviewService) {}

  @Get() @Needs('attendreview', 'view') list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Get('people') @Needs('attendreview', 'view') people(@User() u: any) { return this.service.people(u); }
  @Post('day') @Needs('attendreview', 'decide') day(@Body() b: any, @User() u: any) { return this.service.resolveDay(b, u); }
  @Put('people/:id/pin') @Needs('attendreview', 'decide') pin(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.setPin(id, b, u); }
  @Get('photo/:id') @Needs('attendreview', 'view')
  async photo(@Param('id', ParseIntPipe) id: number, @User() u: any, @Res() res: Response) {
    const bytes = await this.service.photo(id, u);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.contentType('image/jpeg').send(bytes);
  }
}

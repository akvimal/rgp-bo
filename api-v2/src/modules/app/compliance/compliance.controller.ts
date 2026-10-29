import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { AuthModule } from 'src/modules/auth/auth.module';
import { User } from 'src/core/decorator/user.decorator';
import { ComplianceService } from './compliance.service';

/** The register of what is owed (RECOGNITION_AND_COMPLIANCE 3). Every signed-in person reads their own; the store's is for those who oversee it. */
@ApiTags('Compliance')
@Controller('compliance')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Get('mine') mine(@User() u: any) { return this.service.mine(u); }
  @Get('store') store(@User() u: any) { return this.service.store(u); }
  @Post('sync') sync(@User() u: any) { return this.service.syncNow(u); }
  @Get('gate') gate(@Query('storeid') storeid: string, @Query('phase') phase: string, @User() u: any) { return this.service.gate(u, Number(storeid) || 0, phase === 'open' ? 'open' : 'close'); }
  @Get('summary') summary(@User() u: any) { return this.service.summary(u); }
  @Get(':id/events') events(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.events(u, id); }
  @Post(':id/not-mine') notMine(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.notMine(u, id, b?.note); }
  @Post(':id/waiver-request') request(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.requestWaiver(u, id, b?.reason); }
  @Post(':id/waiver') decide(@Param('id', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.decideWaiver(u, id, b || {}); }
}

@Module({ imports: [AuthModule], controllers: [ComplianceController], providers: [ComplianceService], exports: [ComplianceService] })
export class ComplianceModule {}

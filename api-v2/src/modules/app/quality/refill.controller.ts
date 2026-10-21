import { Body, Controller, Get, ParseIntPipe, Param, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { GrievanceService } from './grievance.service';
import { REFILL_OUTCOMES, RefillService } from './refill.service';

class FollowupDto {
  @IsIn(REFILL_OUTCOMES) outcome: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// Business Head (all stores), Store Head and the counter staff (own stores). The counter calls and logs contacts but
// does not see what a customer typically spends.
@ApiTags('Refills')
@Controller('refills')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class RefillController {
  constructor(private readonly service: RefillService, private readonly scopes: GrievanceService) {}

  @Get()
  async list(@Query() q: any, @User() user: any) {
    const sc = await this.scopes.refillScopeFor(user);
    const [list, results] = await Promise.all([
      this.service.list(sc, { bucket: q.bucket, storeid: q.storeid ? +q.storeid : undefined, showsnoozed: q.showsnoozed === 'true' }),
      this.service.results(sc),
    ]);
    if (sc.role === 'Sales Staff') list.rows = list.rows.map((r: any) => { const { typical_value, ...rest } = r; return rest; });
    return { ...list, results };
  }

  @Post(':customerId/followup')
  async followup(@Param('customerId', ParseIntPipe) customerId: number, @Body() dto: FollowupDto, @User() user: any) {
    return this.service.record(await this.scopes.refillScopeFor(user), customerId, dto.outcome, dto.note);
  }
}

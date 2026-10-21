import { BadRequestException, Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { QualityService } from './quality.service';
import { DiscrepancyService } from './discrepancy.service';

// Oversight of people: the business owner only. Site Admin is a platform role with no business data.
const ALLOWED_ROLES = ['Business Head'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

@ApiTags('Quality')
@Controller('quality')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class QualityController {
  constructor(
    private readonly service: QualityService,
    private readonly discrepancy: DiscrepancyService,
    @InjectEntityManager() private readonly manager: EntityManager,
  ) {}

  @Get('staff-sales')
  async staffSales(@Query('from') from: string, @Query('to') to: string, @Query('storeid') storeid: string, @User() user: any) {
    await this.assertAllowed(user);
    if (!DATE.test(from || '') || !DATE.test(to || '')) throw new BadRequestException('from and to must be YYYY-MM-DD');
    if (from > to) throw new BadRequestException('from must not be after to');
    return this.service.staffSales({ from, to, storeid: storeid ? +storeid : undefined });
  }

  @Get('discrepancies')
  async discrepancies(@Query('from') from: string, @Query('to') to: string, @Query('storeid') storeid: string, @User() user: any) {
    await this.assertAllowed(user);
    if (!DATE.test(from || '') || !DATE.test(to || '')) throw new BadRequestException('from and to must be YYYY-MM-DD');
    if (from > to) throw new BadRequestException('from must not be after to');
    return this.discrepancy.report({ from, to, storeid: storeid ? +storeid : undefined });
  }

  private async assertAllowed(user: any) {
    const row = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!ALLOWED_ROLES.includes(row?.[0]?.name)) throw new ForbiddenException('Not authorized.');
  }
}

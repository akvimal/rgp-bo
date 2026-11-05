import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PriceChangesService } from './price-changes.service';

/** The price changes staff sheet: sale prices only, for everyone who serves at the counter. */
@ApiTags('PriceChanges')
@Controller('price-changes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PriceChangesController {
  constructor(private readonly service: PriceChangesService) {}

  @Get()
  async changes(@Query() q: any, @User() user: any) {
    if (!(await this.service.can(user.roleid))) throw new ForbiddenException('The price changes sheet is not open to your role.');
    return this.service.changes(q);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { LookupService } from './lookup.service';

@ApiTags('Lookup')
@Controller('lookup')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get(':entity/:property/:query')
  async findDistinctValues(
    @Param('entity') entity: string,
    @Param('property') property: string,
    @Param('query') query: string,
  ) {
    return this.lookupService.findDistinctValues(entity, property, query);
  }
}

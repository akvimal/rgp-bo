import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { LookupService } from './lookup.service';

@ApiTags('Lookup')
@Controller('lookup')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get(':entity/:property/:query')
  async lookup(
    @Param('entity') entity: string,
    @Param('property') property: string,
    @Param('query') query: string,
  ) {
    return this.lookupService.find(entity, property, query);
  }
}

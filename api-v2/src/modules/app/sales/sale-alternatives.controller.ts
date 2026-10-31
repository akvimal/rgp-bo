import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { SaleSuggestionService } from './sale-suggestion.service';

/** Same-composition alternatives in stock, for the billing screen. Kept apart from the refill-follow-up routes, so that module's switch does not apply. */
@ApiTags('Sales')
@Controller('sale-alternatives')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SaleAlternativesController {
  constructor(private readonly service: SaleSuggestionService) {}

  @Get() alternatives(@Query('productid', ParseIntPipe) productid: number, @Query('storeid') storeid: string) { return this.service.alternatives(productid, Number(storeid) || null); }
}

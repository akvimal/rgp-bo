import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { DrugRefService } from './drug-ref.service';
import { SaleSuggestionService } from './sale-suggestion.service';

/** Same-composition alternatives in stock, for the billing screen. Kept apart from the refill-follow-up routes, so that module's switch does not apply. */
@ApiTags('Sales')
@Controller('sale-alternatives')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SaleAlternativesController {
  constructor(private readonly service: SaleSuggestionService, private readonly dictionary: DrugRefService) {}

  @Get() alternatives(@Query('productid', ParseIntPipe) productid: number, @Query('storeid') storeid: string) { return this.service.alternatives(productid, Number(storeid) || null); }

  /** the brand dictionary: is a list loaded, and the brands matching what was typed */
  @Get('brands') brands(@Query('q') q: string) { return this.dictionary.search(q ?? ''); }

  /** a brand picked from the dictionary: its composition and form, and what the shop has (or other brands to order) */
  @Get('brand') brand(@Query('brandid', ParseIntPipe) brandid: number, @Query('storeid') storeid: string) { return this.dictionary.forBrand(brandid, Number(storeid) || null); }
}

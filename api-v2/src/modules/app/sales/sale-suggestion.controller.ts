import { Body, Controller, Get, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { SaleSuggestionService } from './sale-suggestion.service';

/** Cross-sell and up-sell prompts for the billing screen; anyone who can ring up a sale gets them. */
@ApiTags('Sales')
@Controller('sale-suggestions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SaleSuggestionController {
  constructor(private readonly service: SaleSuggestionService) {}

  @Get('alternatives') alternatives(@Query('productid', ParseIntPipe) productid: number, @Query('storeid') storeid: string) { return this.service.alternatives(productid, Number(storeid) || null); }
  @Post() suggest(@Body() b: any) { return this.service.suggest(b); }
  @Post('events') log(@Body() b: any, @User() u: any) { return this.service.log(b?.events, Number(b?.storeid) || null, u.id); }
}

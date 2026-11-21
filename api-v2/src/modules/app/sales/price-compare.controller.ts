import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { PriceCompareService } from './price-compare.service';

/**
 * The shop's prices against the PMBI Jan Aushadhi list, other sellers' lists and the market (see PriceCompareService). The comparison of the shop's own
 * products is for people who may set prices; the list prices of a composition and the market lookup are open to anyone signed in (the Check brand dialog
 * at the counter uses them: they hold no cost and no customer data).
 */
@ApiTags('Price comparison')
@Controller('price-compare')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PriceCompareController {
  constructor(private readonly service: PriceCompareService, private readonly permissions: PermissionService) {}

  private async assertPricing(user: any) {
    if (!(await this.permissions.canManagePricing(user.roleid))) throw new ForbiddenException('Pricing access denied');
  }

  /** every product with a composition against the loaded lists */
  @Get('products')
  async products(@User() user: any, @Query() q: any) {
    await this.assertPricing(user);
    const n = (v: any) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    return this.service.list({ q: q?.q, source: n(q?.source), onlyMatched: q?.matched === '1', minGap: n(q?.mingap), inStock: q?.instock === '1', storeId: n(q?.storeid) });
  }

  /** one product: its price and the lists' prices; `price` is a price before GST being considered */
  @Get('product/:id')
  async product(@User() user: any, @Param('id', ParseIntPipe) id: number, @Query('price') price: string) {
    await this.assertPricing(user);
    const n = Number(price);
    return this.service.forProduct(id, Number.isFinite(n) && n > 0 ? n : null);
  }

  /** a composition's list prices (the Check brand dialog) */
  @Get('composition')
  composition(@Query('composition') composition: string, @Query('form') form: string) {
    return this.service.forComposition(String(composition || ''), form ? String(form) : null);
  }

  /** what an earlier market lookup kept for a product's or a typed composition (free) */
  @Get('market')
  market(@Query('productid') productid: string, @Query('composition') composition: string, @Query('form') form: string) {
    return this.service.marketKept({ productid, composition, form });
  }

  /** looks the market price up on the web (uses the assistant: counted against the monthly limit); a kept answer under a month old is returned unless `refresh` */
  @Post('market')
  marketLookup(@Body() body: any, @User() user: any) {
    return this.service.marketLookup({ productid: body?.productid, composition: body?.composition, form: body?.form, refresh: !!body?.refresh }, user);
  }
}

import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { ProductService } from './product.service';
import { PricingService } from './pricing.service';

/**
 * The price policy: the review queue of prices that are out of policy, applying the next step, the class table, and exceptions.
 * Anyone who may see cost can read the queue; applying needs pricing access and the right level (see PricingService.prepareStep);
 * changing the class table and accepting exceptions is for the Business Head only.
 */
@ApiTags('Pricing')
@Controller('pricing')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PricingController {
  constructor(private readonly pricing: PricingService, private readonly products: ProductService, private readonly permissions: PermissionService) {}

  private async assertCost(user: any) {
    if (!(await this.permissions.canViewCost(user.roleid))) throw new ForbiddenException('Cost access denied');
  }
  private async assertPricing(user: any) {
    if (!(await this.permissions.canManagePricing(user.roleid))) throw new ForbiddenException('Pricing access denied');
  }
  private async assertBusinessHead(user: any) {
    if ((await this.pricing.actorLevel(user.id)) !== 'BUSINESS') throw new ForbiddenException('Only the Business Head can do this.');
  }

  @Get('/review')
  async review(@User() user: any) {
    await this.assertCost(user);
    return this.pricing.queue(user.id);
  }

  @Get('/performance')
  async performance(@User() user: any) {
    await this.assertCost(user);
    return this.pricing.performance();
  }

  @Get('/impact')
  async impact(@User() user: any) {
    await this.assertCost(user);
    return this.pricing.impact();
  }

  @Post('/apply')
  async apply(@Body() body: any, @User() user: any) {
    await this.assertPricing(user);
    const productid = Number(body?.productid);
    if (!Number.isInteger(productid) || productid <= 0) throw new BadRequestException('Say which product.');
    return this.applyOne(productid, user.id);
  }

  /** Every price above the legal ceiling goes down to it at once (customers only gain). */
  @Post('/apply-cuts')
  async applyCuts(@User() user: any) {
    await this.assertPricing(user);
    const { items } = await this.pricing.queue(user.id);
    const cuts = items.filter((i: any) => i.action === 'CUT' && i.canapply);
    let applied = 0;
    const failed: any[] = [];
    for (const c of cuts) {
      try { await this.applyOne(c.productid, user.id); applied++; }
      catch (e: any) { failed.push({ productid: c.productid, title: c.title, message: e?.message }); }
    }
    return { applied, failed };
  }

  private async applyOne(productid: number, userid: number) {
    const it = await this.pricing.prepareStep(productid, userid);
    const saved = await this.products.addPrice(
      { productid, saleprice: it.next as number, reason: 'Policy', comments: `Policy step to ${it.target} (${it.violations.join(', ')})` } as any,
      userid, { policyApproved: true });
    await this.pricing.audited(userid, 'price.policy_step', productid, `${it.title}: price ${it.price} -> ${it.next} (target ${it.target}; ${it.violations.join(', ')})`,
      { from: it.price, to: it.next, target: it.target, violations: it.violations, class: it.classkey });
    return { productid, title: it.title, from: it.price, to: saved.saleprice, target: it.target, done: Number(saved.saleprice) === Number(it.target) };
  }

  /** Gives a product that has stock and no price the policy's suggested first price. */
  @Post('/price-new')
  async priceNew(@Body() body: any, @User() user: any) {
    await this.assertPricing(user);
    const productid = Number(body?.productid);
    if (!Number.isInteger(productid) || productid <= 0) throw new BadRequestException('Say which product.');
    return this.priceOne(productid, user.id);
  }

  /** Gives every product that has stock and no price its suggested first price (those with a suggestion only). */
  @Post('/price-new-all')
  async priceNewAll(@User() user: any) {
    await this.assertPricing(user);
    const { unpriced } = await this.pricing.queue(user.id);
    let applied = 0;
    const failed: any[] = [];
    for (const u of unpriced.filter((x: any) => x.canapply)) {
      try { await this.priceOne(u.productid, user.id); applied++; }
      catch (e: any) { failed.push({ productid: u.productid, title: u.title, message: e?.message }); }
    }
    return { applied, failed };
  }

  private async priceOne(productid: number, userid: number) {
    const u = await this.pricing.prepareNew(productid, userid);
    const saved = await this.products.addPrice(
      { productid, saleprice: u.suggestion!.price, reason: 'Initial', comments: `First price from the pricing policy (class ${u.classkey}, ${u.suggestion!.discountPct}% off MRP)` } as any,
      userid, { policyApproved: true });
    await this.pricing.audited(userid, 'price.first_price', productid, `${u.title}: first price ${saved.saleprice} (class ${u.classkey}, ${u.suggestion!.discountPct}% off MRP, markup ${u.suggestion!.markupPct}%)`,
      { price: saved.saleprice, class: u.classkey, cost: u.cost, mrp: u.mrp, discountPct: u.suggestion!.discountPct, markupPct: u.suggestion!.markupPct });
    return { productid, title: u.title, price: Number(saved.saleprice), discountpct: u.suggestion!.discountPct, markuppct: u.suggestion!.markupPct };
  }

  /** What the Set the price dialog needs for one product, and (with ?price=) whether that price breaks the policy and whether the user may approve it. */
  @Get('/product/:id/check')
  async productCheck(@Param('id', ParseIntPipe) id: number, @Query('price') price: string, @User() user: any) {
    await this.assertCost(user);
    const n = price === undefined || price === '' ? null : Number(price);
    return this.pricing.productCheck(id, n !== null && Number.isFinite(n) ? n : null, user.id);
  }

  /** What each line of a purchase invoice means for the product's current price. */
  @Get('/invoice/:id/impact')
  async invoiceImpact(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    await this.assertCost(user);
    return this.pricing.invoiceImpact(id);
  }

  /** How the business prices (at the MRP, a discount off it, or smart groups) and whether prices show with GST. */
  @Get('/mode')
  async mode(@User() user: any) {
    await this.assertCost(user);
    return { settings: await this.pricing.mode(), canedit: (await this.pricing.actorLevel(user.id)) === 'BUSINESS' };
  }

  @Put('/mode')
  async saveMode(@Body() body: any, @User() user: any) {
    await this.assertBusinessHead(user);
    return this.pricing.saveMode(body, user.id);
  }

  /** A worked example of a setting before it is saved: no change is made. */
  @Post('/mode/preview')
  async previewMode(@Body() body: any, @User() user: any) {
    await this.assertCost(user);
    return this.pricing.previewMode(body);
  }

  /** Applies this step's price to every product that is out of policy and that the user may apply now (under MRP, that is each product's MRP). */
  @Post('/apply-raises')
  async applyRaises(@User() user: any) {
    await this.assertPricing(user);
    const { items } = await this.pricing.queue(user.id);
    let applied = 0;
    const failed: any[] = [];
    for (const i of items.filter((x: any) => x.action === 'RAISE' && x.canapply)) {
      try { await this.applyOne(i.productid, user.id); applied++; }
      catch (e: any) { failed.push({ productid: i.productid, title: i.title, message: e?.message }); }
    }
    return { applied, failed };
  }

  @Get('/policy')
  async policy(@User() user: any) {
    await this.assertCost(user);
    return { classes: await this.pricing.policyTable(), settings: await this.pricing.settings() };
  }

  @Get('/rules')
  async rules(@User() user: any) {
    await this.assertCost(user);
    return { rules: await this.pricing.rules(), canedit: (await this.pricing.actorLevel(user.id)) === 'BUSINESS' };
  }

  @Put('/rules')
  async updateRules(@Body() body: any, @User() user: any) {
    await this.assertBusinessHead(user);
    return this.pricing.updateRules(body?.values, user.id);
  }

  @Put('/policy/:key')
  async updatePolicy(@Param('key') key: string, @Body() body: any, @User() user: any) {
    await this.assertBusinessHead(user);
    return this.pricing.updatePolicy(key, Number(body?.floor), Number(body?.cap), user.id, body?.usual === undefined || body?.usual === null || body?.usual === '' ? undefined : Number(body.usual));
  }

  @Post('/exceptions')
  async addException(@Body() body: any, @User() user: any) {
    await this.assertBusinessHead(user);
    return this.pricing.addException(Number(body?.productid), String(body?.reason ?? ''), String(body?.until ?? ''), user.id);
  }

  @Delete('/exceptions/:productid')
  async removeException(@Param('productid', ParseIntPipe) productid: number, @User() user: any) {
    await this.assertBusinessHead(user);
    return this.pricing.removeException(productid, user.id);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PurchaseInvoiceService } from "../purchases/purchase-invoice.service";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductQtyChangeDto } from "./dto/create-product-qtychange.dto";
import { StockService } from "./stock.service";
import { User } from "src/core/decorator/user.decorator";
import { PermissionService } from "../roles/permission.service";
import { PermissionGuard } from "src/core/guards/permission.guard";
import { Permission } from "src/core/decorator/permission.decorator";

@ApiTags('Stock')
@Controller('stock')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StockController {

    constructor(private service: StockService, private invoiceService: PurchaseInvoiceService, private permissions: PermissionService) {}

    private redactCostFields(data: any) {
      if (!data) return data;
      const strip = (value: any): any => {
        if (Array.isArray(value)) return value.map(strip);
        if (value && typeof value === 'object') {
          const clone: any = {};
          Object.entries(value).forEach(([key, entry]) => {
            if (['mrp_cost', 'ptr_cost', 'ptr_value', 'oldprice', 'cost'].includes(key)) return;
            clone[key] = strip(entry);
          });
          return clone;
        }
        return value;
      };
      return strip(data);
    }

    @Post('/filter')
    async filterByCriteria(@Body() criteria, @User() currentUser: any) {
      const items = await this.service.findByCriteria(criteria);
      return (await this.permissions.canViewCost(currentUser.roleid)) ? items : this.redactCostFields(items);
    }

    @Get('/ready')
    @UseGuards(PermissionGuard)
    @Permission('viewCost')
    async findAllReady() {
      return this.service.findAllReady();
    }

    @Post('/products')
    async findByProducts(@Body() input, @User() currentUser: any) {
      const prods: any[] = [];
      const items: any[] = await this.service.findByProducts(input);
      items.forEach((product: any) => {
        if (!prods.find(i => i['id'] == product['id'])) prods.push(product);
      });
      const canViewCost = await this.permissions.canViewCost(currentUser.roleid);
      return canViewCost ? prods : this.redactCostFields(prods);
    }

    @Post('/demand')
    async findDemand(@Body() input: { begindt: string; enddt: string; orders_avail: boolean }) {
      return this.service.findStockDemand(input);
    }

    @Get('/adjust/price')
    @UseGuards(PermissionGuard)
    @Permission('managePricing')
    async findAllPriceAdjust() {
      return (await this.service.findAllPriceAdjust()).map((data: any) => ({
        itemid: data.purchaseitem.id,
        title: data.purchaseitem.product.title,
        date: data.createdon,
        price: data.price,
        batch: data.purchaseitem.batch,
        expdate: data.purchaseitem.expdate,
        oldprice: data.oldprice,
        comments: data.comments
      }));
    }

    @Get('/adjust/qty')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async findAllQtyAdjust() {
      return (await this.service.findAllQtyAdjust()).map((data: any) => ({
        id: data.id,
        itemid: data.purchaseitem.id,
        title: data.purchaseitem.product.title,
        date: data.createdon,
        qty: data.qty,
        price: data.price,
        batch: data.purchaseitem.batch,
        expdate: data.purchaseitem.expdate,
        reason: data.reason,
        reasoncode: data.reasoncode,
        status: data.status,
        comments: data.comments
      }));
    }

    @Put('/adjust/qty/:id')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async updateQtyAdjustment(@Param('id') id: string, @Body() dto: any, @User() currentUser: any) {
      return this.service.updateQtyAdjustment(id, dto, currentUser.id);
    }

    @Post('/adjust/price')
    @UseGuards(PermissionGuard)
    @Permission('managePricing')
    async createPrice(@Body() createDto: CreateProductPriceDto, @User() currentUser: any) {
      await this.invoiceService.updateItems([createDto.itemid], { saleprice: createDto.price }, currentUser.id);
      return this.service.createPrice(createDto, currentUser.id);
    }

    @Post('/adjust/qty')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async updateQty(@Body() createDto: CreateProductQtyChangeDto, @User() currentUser: any) {
      return this.service.createQty(createDto, currentUser.id);
    }

    @Post('/adjust/qty/bulk')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async updateQtyBulkToZero(@Body() obj: any, @User() currentUser: any) {
      const data = await this.service.findPurchaseItemsWithAvailable(obj.ids);
      for (const element of data) {
        if (+element['available'] === 0) continue; // nothing to clear at this store
        await this.service.createQty({
          itemid: element['purchase_itemid'], qty: -1 * +element['available'], status: 'APPROVED',
          reason: obj['reason'], comments: obj['comments'], storeid: element['storeid'],
        } as any, currentUser.id);
      }
      return data;
    }

    @Post('/adjust/returns')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async adjustReturnItems(@Body() items: CreateProductQtyChangeDto[], @User() currentUser: any) {
      return this.service.createStockAdjustments(items, currentUser.id);
    }

    @Get('/audit')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async findPendingAudits() {
      return this.service.findQtyAudits();
    }

    @Post('/audit')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async createAudit(@Body() items: any[], @User() currentUser: any) {
      return this.service.createStockAudit(items, currentUser.id);
    }

    @Put('/audit/:id/approve')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async approveAudit(@Param('id') id: string, @User() currentUser: any) {
      return this.service.approveQtyAudit(id, currentUser.id);
    }

    @Put('/audit/:id/reject')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async rejectAudit(@Param('id') id: string, @User() currentUser: any) {
      return this.service.rejectQtyAudit(id, currentUser.id);
    }

    @Post('/counts')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async startCount(@Body() body: any, @User() currentUser: any) {
      return this.service.startCount(body, currentUser.id);
    }

    @Get('/counts')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async findCounts() {
      return this.service.findCounts();
    }

    @Get('/counts/:id')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async findCountDetail(@Param('id') id: string) {
      return this.service.findCountDetail(+id);
    }

    @Post('/counts/:id/submit')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async submitCount(@Param('id') id: string, @Body() body: any, @User() currentUser: any) {
      return this.service.submitCount(+id, body.items, currentUser.id);
    }

    @Delete('/adjust/qty/:id')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    async remove(@Param('id') id: string) {
      return this.service.deleteQtyAdjustment(id);
    }
}

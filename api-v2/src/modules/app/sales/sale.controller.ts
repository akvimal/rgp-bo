import { SaleService } from "./sale.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { CustomerService } from "../customers/customer.service";
import { CreateSaleReturnItemDto } from "./dto/create-salereturnitem.dto";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturnitem.dto";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { AuditService } from "src/core/audit/audit.service";

@ApiTags('Sales')
@Controller('sales')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SaleController {

    constructor(private saleService:SaleService, 
      private custService:CustomerService,
      private audit:AuditService,
      @InjectEntityManager() private manager:EntityManager){}

      /**
       * Who the bill is recorded against. Sales Staff always act as themselves (each person signs in
       * with their own login); Store Head / Business Head may enter a bill on behalf of someone else.
       * Every on-behalf entry, and every blocked attempt, is written to the audit log.
       */
      private async resolveActingUser(requested: any, currentUser: any, saleId?: number): Promise<number> {
        const asked = requested ? Number(requested) : currentUser.id;
        if (asked === currentUser.id) return asked;
        const row = await this.manager.query(`select name from app_role where id = $1`, [currentUser.roleid || 0]);
        const blocked = row?.[0]?.name === 'Sales Staff';
        await this.audit.record({
          userId: currentUser.id, actingUserId: asked, action: blocked ? 'sale.acting_blocked' : 'sale.on_behalf',
          entityType: 'sales', entityId: saleId ?? null,
          summary: blocked ? 'Sales Staff tried to bill as another user; recorded under own login' : 'bill entered on behalf of another user',
        });
        return blocked ? currentUser.id : asked;
      }

      @Post()
      async create(@Body() createSaleDto: CreateSaleDto, @User() currentUser: any) {

        let customer = createSaleDto.customer;
        if(customer){ //if customer not present before
          customer = await this.custService.save(createSaleDto.customer);
        }
        
        const actingUserId = await this.resolveActingUser(createSaleDto.actinguserid, currentUser);
        return this.saleService.create({...createSaleDto, customer}, currentUser.id, actingUserId);
      }

      @Put()
      async update(@Body() updateSaleDto: any, @User() currentUser: any) {
        //get the itemid that is removed at client end
        const sale = await this.saleService.findById(updateSaleDto.id);
        const existingItemIds = sale?.items?.map(i => i.id);
        const newIntemIds = updateSaleDto['items'].map(i => i.id);
        if(existingItemIds){
          const removedItemIds = existingItemIds.filter(num => !newIntemIds.includes(num));        
          if(removedItemIds.length > 0 ){
            await this.saleService.removeItemsByIds(removedItemIds);
          }
        }

        let customer = updateSaleDto.customer;
        if(customer){ //if customer not present before
          customer = await this.custService.save(updateSaleDto.customer);
        }
        const actingUserId = await this.resolveActingUser(updateSaleDto.actinguserid, currentUser, updateSaleDto.id);
        const saved = await this.saleService.updateSale({...updateSaleDto, customer}, currentUser.id, actingUserId);
        await this.recordSaleEdit(sale, updateSaleDto, currentUser.id, actingUserId);
        return saved;
      }

    /** What changed on an edited bill: the facts a reviewer needs (total, discount, status, lines removed, price/qty changes). */
    private async recordSaleEdit(before: any, after: any, userId: number, actingUserId: number) {
      if (!before) return;
      const changes: Record<string, any> = {};
      const track = (k: string, a: any, b: any) => { if (a !== undefined && b !== undefined && Number(a) !== Number(b) && String(a) !== String(b)) changes[k] = { from: a, to: b }; };
      track('total', before.total, after.total);
      track('discamount', before.discamount, after.discamount);
      track('status', before.status, after.status);
      track('cashamt', before.cashamt, after.cashamt);
      track('digiamt', before.digiamt, after.digiamt);
      const oldItems = new Map<number, any>((before.items || []).map((i: any) => [i.id, i]));
      const newIds = new Set<number>((after.items || []).map((i: any) => i.id));
      const removed = [...oldItems.keys()].filter(id => !newIds.has(id)).length;
      if (removed) changes['items_removed'] = removed;
      const edited = (after.items || []).filter((i: any) => {
        const o = oldItems.get(i.id);
        return o && (Number(o.price) !== Number(i.price) || Number(o.qty) !== Number(i.qty) || Number(o.total) !== Number(i.total));
      }).length;
      if (edited) changes['items_changed'] = edited;
      if (!Object.keys(changes).length) return;
      await this.audit.record({
        userId, actingUserId: actingUserId !== userId ? actingUserId : null, action: 'sale.edit',
        entityType: 'sales', entityId: after.id,
        summary: `bill ${before.billno ?? after.id} edited (${Object.keys(changes).join(', ')})`,
        details: { billno: before.billno, billdate: before.billdate, changes },
      });
    }

    @Post('/items')
    async createItem(@Body() createSaleItemDto: CreateSaleItemDto, @User() currentUser: any) {
      return this.saleService.createItem(createSaleItemDto, currentUser.id);
    }

    @Post('/returns')
    async returnItem(@Body() items:CreateSaleReturnItemDto[], @User() currentUser: any) {
      return this.saleService.createReturnItems(items, currentUser.id);
    } 
    
    @Put('/returns')
    async updateReturnItem(@Body() item:UpdateSaleReturnItemDto, @User() currentUser: any) {
      return this.saleService.updateReturnItem(item, currentUser.id);
    }

    @Get('/raw')
    async findAllSales() {
      return this.saleService.getSales();
    }

    @Get('/returns/:id/eligible')
    async getEligibleReturns(@Param('id') id: number) {
      const items = await this.saleService.getEligibleReturns(id);
      const sale = await this.saleService.findById(id);
      return {...sale, items};
    }
    
    @Get('/returns/items/:rid')
    async getReturnItemToAdjust(@Param('rid') rid: number) {
      return await this.saleService.getReturnItemToAdjust(rid);
    }

    @Get('/returns/:id/sale')
    async getSaleReturnItems(@Param('id') id: number) {
      return await this.saleService.getSaleReturnItems(id);
    }

    @Get('/visits/:days')
    async findDaysVisited(@Param('days') days: number) {
      return this.saleService.findVisits({maxdays:days})
    }
    
    @Get('/returns')
    async findAllReturns() {
      return this.saleService.getReturns();
    }

    @Post('/data')
    async getSalesByFreq(@Body() criteria: any) {
      return this.saleService.getSalesByFreq(criteria.fromdate,criteria.freq,criteria.count);
    }

    @Post('/visits')
    async getCustomerByFreq(@Body() criteria: any) {
      return this.saleService.getCustomerVisitByFreq(criteria.fromdate,criteria.freq,criteria.count);
    }

    @Get()
    async findAll(@Query() query: any, @User() currentUser: any) {
      const actingUserId = query['actinguserid'] ? Number(query['actinguserid']) : null;
      return this.saleService.findAll(query, actingUserId, currentUser?.id);
    }

    @Get('/staff-summary')
    async getStaffSummary(@Query() query: any, @User() currentUser: any) {
      return this.saleService.getStaffSummary(query, currentUser?.id);
    }

    @Get('/page/count')
    async countAll(@Query() query: any, @User() currentUser: any) {
      const actingUserId = query['actinguserid'] ? Number(query['actinguserid']) : null;
      const result = await this.saleService.findAll({ ...query, page: '1', limit: '1' }, actingUserId, currentUser?.id);
      return { total: result.total };
    }

    @Get('/saved')
    async findAllSaved() {
      return this.saleService.findSavedSales();
    }

    @Post('/items/criteria')
    async findAllItems(@Body() criteria: any, @User() currentUser: any) {
      return this.saleService.findAllItems(criteria,undefined);
    }

    @Get('/:id')
    async findById(@Param('id') id: number) {
      const sale = await this.saleService.findById(id);
      return sale;//this.stockService.getItemsWithStockData(sale);
    }

    @Get('/:id/availableitems')
    async findSaleItemsForSaleWithAvailableQty(@Param('id') id: number) {
      return await this.saleService.findSaleItemsForSaleWithAvailableQty(id)
    }
    
    // @Get('/:id/:year/:month/customer')
    // async findCustomerSaleByPeriod(@Param('id') custid: string,
    //     @Param('year') year: number,
    //     @Param('month') month: number) {
    //   return await this.saleService.findCustomerSaleByPeriod(custid,year,month);
    // }   
    
    // @Get('/:id/customer/months')
    // async findCustomerSaleMonths(@Param('id') custid: string) {
    //   return await this.saleService.findCustomerSaleMonths(custid);
    // }

    @Get('/:id/items')
    async findAllItemsBySale(@Param('id') id: string) {
      return this.saleService.findAllItemsBySale(id);
    }
    
    @Get('/:id/items/return')
    async findAllItemsToReturn(@Param('id') id: string) {
      return this.saleService.findAllEligibleItemsToReturn(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.saleService.delete(id, currentUser?.id);
    }
    
    @Delete('items/:id')
    removeItem(@Param('id') id: string, @User() currentUser: any) {
      return this.saleService.removeItem(id, currentUser.id);
    }

    @Delete('returns/:id')
    removeReturnItem(@Param('id') id: string) {
      return this.saleService.removeReturnItem(id);
    }
}

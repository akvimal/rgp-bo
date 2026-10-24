import { SaleService } from "./sale.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { checkDigitalPayment } from "./digital-payment";
import { checkStaffCredit } from "./staff-credit-rule";
import { checkStoreCredit } from "./store-credit-rule";
import { enforceBatchWarnings, findBatchWarnings } from "./batch-rules";
import { CustomerService } from "../customers/customer.service";
import { CreateSaleReturnItemDto } from "./dto/create-salereturnitem.dto";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturnitem.dto";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { AuditService } from "src/core/audit/audit.service";
import { loadStoreProfile } from "../store/store-profile";
import { RETURN_RULES } from "./return-rule";

import { isManagerRole, NOT_A_PERSON } from 'src/core/roles';
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
       * A completed bill that includes a chronic medicine must carry a real customer mobile number: those
       * customers are the ones refill reminders and follow-ups depend on. "NIL" (mobile 0000000000) or no
       * customer does not qualify.
       */
      private async assertMobileForChronic(sale: any, customer: any) {
        if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return;
        const productIds = (Array.isArray(sale.items) ? sale.items : [])
          .map((i: any) => Number(i.productid ?? i.product_id)).filter((n: number) => Number.isFinite(n) && n > 0);
        if (!productIds.length) return;
        let mobile: string = String(customer?.mobile ?? '').trim();
        const customerId = customer?.id ?? sale.customerid;
        if (!mobile && customerId) {
          const row = await this.manager.query(`select mobile from customer where id = $1`, [customerId]);
          mobile = String(row?.[0]?.mobile ?? '').trim();
        }
        if (mobile && mobile !== '0000000000') return;
        const chronic = await this.manager.query(
          `select title from product where id = any($1::int[]) and more_props->>'chronic' = 'true' order by title limit 5`, [productIds]);
        if (chronic.length) {
          throw new BadRequestException(`A customer mobile number is required for bills with chronic medicines (${chronic.map((c: any) => c.title).join(', ')}).`);
        }
      }

      /**
       * Who the bill is recorded against. Sales Staff always act as themselves (each person signs in
       * with their own login); Store Head / Business Head may enter a bill on behalf of someone else.
       * Every on-behalf entry, and every blocked attempt, is written to the audit log.
       */
      private async resolveActingUser(requested: any, currentUser: any, saleId?: number, storeId?: number | null): Promise<number> {
        const asked = requested ? Number(requested) : currentUser.id;
        if (asked === currentUser.id) return asked;
        const row = await this.manager.query(`select name from app_role where id = $1`, [currentUser.roleid || 0]);
        const role = row?.[0]?.name;
        // a staff-based store that does not ask for an operator bills as the signed-in person (managers may still enter for others)
        const profile = storeId ? await loadStoreProfile(this.manager, storeId) : null;
        const ownBillsOnly = !!profile && profile.shiftmode === 'staff' && !profile.operatorrequired && !isManagerRole(role) && role !== 'Counter';
        // a Counter login is the shared till, not a person: it is meant to bill as whoever is serving
        const blocked = role === 'Sales Staff' || ownBillsOnly;
        await this.audit.record({
          userId: currentUser.id, actingUserId: asked, action: blocked ? 'sale.acting_blocked' : 'sale.on_behalf',
          entityType: 'sales', entityId: saleId ?? null,
          summary: blocked ? 'Sales Staff tried to bill as another user; recorded under own login' : 'bill entered on behalf of another user',
        });
        return blocked ? currentUser.id : asked;
      }

      /**
       * The shared Counter login is not a person: a completed bill from it must name who is serving, and that person must work
       * at the store. (Personal and Sales Staff logins bill as themselves.)
       */
      private async assertOperatorNamed(sale: any, currentUser: any): Promise<void> {
        if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return;
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [currentUser.roleid || 0]);
        if (role?.name !== 'Counter') return;
        const storeId = await this.billStore(sale);
        const profile = storeId ? await loadStoreProfile(this.manager, storeId) : null;
        if (profile && !profile.operatorrequired) return;
        const asked = Number(sale?.actinguserid) || 0;
        if (!asked || asked === currentUser.id) throw new BadRequestException('Choose who is serving before completing the bill.');
        const [who] = await this.manager.query(
          `select r.name from app_user u join app_role r on r.id = u.role_id
            where u.id = $1 and u.active and not u.archive
              and (r.name in ('Business Head', 'Owner-operator') or exists (select 1 from user_stores us where us.user_id = u.id and us.store_id = $2 and us.active and not us.archive))`, [asked, storeId]);
        if (!who || NOT_A_PERSON.includes(who.name)) throw new BadRequestException('That person does not work at this store.');
      }

      /** the store a bill is for: the one it names, else the business's first (same fallback as saving it) */
      private async billStore(sale: any): Promise<number | null> {
        const asked = Number(sale?.storeid) || null;
        if (asked) {
          const ok = await this.manager.query(`select id from stores where id = $1`, [asked]);
          if (ok.length) return asked;
        }
        const first = await this.manager.query(`select id from stores order by id asc limit 1`);
        return first?.[0]?.id || null;
      }

      /**
       * Older-batch-first and long-enough-expiry checks. Counter staff confirm ordinary warnings; a supply that would
       * outlive its batch needs a Store Head or Business Head. Anything sold through is written to the audit log.
       */
      private async checkBatches(sale: any, currentUser: any): Promise<(saleId: number | null) => Promise<void>> {
        const warnings = await findBatchWarnings(this.manager, sale, await this.billStore(sale));
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [currentUser?.roleid || 0]);
        const isManager = isManagerRole(role?.name);
        const overridden = enforceBatchWarnings(warnings, sale?.ackwarnings === true, isManager);
        return async (saleId: number | null) => {
          if (!overridden.length) return;
          await this.audit.record({ userId: currentUser.id, action: 'sale.batch_warning_overridden', entityType: 'sale', entityId: saleId,
            summary: `Sold through ${overridden.length} batch warning${overridden.length === 1 ? '' : 's'}: ${overridden.map(w => w.code).join(', ')}`,
            details: { warnings: overridden.map(w => ({ code: w.code, title: w.title, message: w.message })) } });
        };
      }

      @Post()
      async create(@Body() createSaleDto: CreateSaleDto, @User() currentUser: any) {

        let customer = createSaleDto.customer;
        if(customer){ //if customer not present before
          customer = await this.custService.save(createSaleDto.customer);
        }
        
        await this.assertMobileForChronic(createSaleDto, customer);
        const recordBatchOverride = await this.checkBatches(createSaleDto, currentUser);
        const digital = await checkDigitalPayment(this.manager, createSaleDto);
        const staffCredit = await checkStaffCredit(this.manager, createSaleDto);
        const storeCredit = await checkStoreCredit(this.manager, createSaleDto, customer);
        await this.assertOperatorNamed(createSaleDto, currentUser);
        const actingUserId = await this.resolveActingUser(createSaleDto.actinguserid, currentUser, undefined, await this.billStore(createSaleDto));
        const created = await this.saleService.create({...createSaleDto, ...(digital || {}), ...(staffCredit || {}), ...(storeCredit || {}), customer}, currentUser.id, actingUserId);
        await recordBatchOverride((created as any)?.id ?? null);
        return created;
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
        await this.assertMobileForChronic(updateSaleDto, customer);
        const recordBatchOverride = await this.checkBatches(updateSaleDto, currentUser);
        const digital = await checkDigitalPayment(this.manager, updateSaleDto, updateSaleDto.id);
        const staffCredit = await checkStaffCredit(this.manager, updateSaleDto, updateSaleDto.id);
        const storeCredit = await checkStoreCredit(this.manager, updateSaleDto, customer, updateSaleDto.id);
        await this.assertOperatorNamed(updateSaleDto, currentUser);
        const actingUserId = await this.resolveActingUser(updateSaleDto.actinguserid, currentUser, updateSaleDto.id, await this.billStore(updateSaleDto));
        const saved = await this.saleService.updateSale({...updateSaleDto, ...(digital || {}), ...(staffCredit || {}), ...(storeCredit || {}), customer}, currentUser.id, actingUserId);
        await this.recordSaleEdit(sale, updateSaleDto, currentUser.id, actingUserId);
        await recordBatchOverride(updateSaleDto.id ?? null);
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

    /** the product categories and what each does on return; the business's own list, never another's */
    @Get('/return-rules')
    async returnRules(@User() currentUser: any) {
      const [u] = await this.manager.query(`select business_id from app_user where id = $1`, [currentUser.id]);
      const rows = await this.manager.query(
        `select c.category, crr.rule, c.products::int as products
           from (select category, count(*) as products from product where active and not archive and coalesce(btrim(category), '') <> '' group by category) c
           left join return_category_rule crr on crr.business_id = $1 and lower(crr.category) = lower(c.category)
          order by c.category`, [u?.business_id ?? 0]);
      return rows.map((r: any) => ({ category: r.category, rule: r.rule || null, products: r.products }));
    }

    /** Business Head or Owner-operator: set what a category does on return (rule null: free, like any other) */
    @Put('/return-rules')
    async saveReturnRule(@Body() body: any, @User() currentUser: any) {
      const [u] = await this.manager.query(
        `select u.business_id, r.name as role from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [currentUser.id]);
      if (!u || !['Business Head', 'Owner-operator'].includes(u.role)) throw new ForbiddenException('Only the business owner sets what may be returned.');
      const category = String(body?.category || '').trim();
      if (!category) throw new BadRequestException('Choose a category.');
      const rule = body?.rule === null || body?.rule === '' || body?.rule === undefined ? null : String(body.rule).toUpperCase();
      if (rule !== null && !RETURN_RULES.includes(rule as any)) throw new BadRequestException('A category is free to return, inspected first, or not accepted.');
      if (rule === null || rule === 'FREE') {
        await this.manager.query(`delete from return_category_rule where business_id = $1 and lower(category) = lower($2)`, [u.business_id, category]);
      } else {
        await this.manager.query(
          `insert into return_category_rule (business_id, category, rule) values ($1, $2, $3)
           on conflict (business_id, category) do update set rule = excluded.rule`, [u.business_id, category, rule]);
      }
      await this.audit.record({ userId: currentUser.id, action: 'returns.rule_changed', entityType: 'return_category_rule', entityId: null,
        summary: `${category}: ${rule === null || rule === 'FREE' ? 'free to return' : rule === 'INSPECT' ? 'inspected before taken back' : 'not taken back'}`, details: { category, rule } });
      return { category, rule: rule === 'FREE' ? null : rule };
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

    @Get('/returns')
    async findAllReturns() {
      return this.saleService.getReturns();
    }

    @Post('/data')
    async getSalesByFreq(@Body() criteria: any) {
      return this.saleService.getSalesByFreq(criteria.fromdate,criteria.freq,criteria.count);
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

    /**
     * Who the bill is from, for the printed copy: the business and the store that made the sale, with the store's own address,
     * phone and licence numbers. Whatever has not been filled in comes back empty (the bill leaves those lines out).
     */
    @Get('/:id/bill')
    async billHeader(@Param('id') id: number) {
      const [sale] = await this.manager.query(`select store_id from sale where id = $1`, [Number(id)]);
      if (!sale) throw new NotFoundException('Bill not found.');
      const [store] = await this.manager.query(
        `select st.id, st.location, st.address, st.pincode, st.phone, st.business_id,
                b.name as business_name, b.legal_name, b.gstin, b.address as business_address, b.pincode as business_pincode,
                (select count(*) from stores s2 where s2.business_id = st.business_id and s2.active = true and s2.archive = false)::int as store_count
           from stores st join business b on b.id = st.business_id where st.id = $1`, [sale.store_id]);
      if (!store) return { store: null, business: null, licences: [] };
      const licences = await this.manager.query(
        `select license_type as type, number, valid_to as validto from store_license where store_id = $1 order by id`, [store.id]);
      return {
        business: { name: store.business_name, legalname: store.legal_name, gstin: store.gstin, address: store.business_address, pincode: store.business_pincode },
        store: { name: store.location, address: store.address, pincode: store.pincode, phone: store.phone },
        multistore: Number(store.store_count) > 1,
        licences,
      };
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

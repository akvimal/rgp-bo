import { SaleService } from "./sale.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { checkDigitalPayment } from "./digital-payment";
import { checkStaffCredit } from "./staff-credit-rule";
import { checkCustomerDue } from "./customer-due-rule";
import { checkStoreCredit } from "./store-credit-rule";
import { effectiveBillLayout } from "src/core/bill-layout";
import { checkCommitmentTender } from "../commitments/commitment-db";
import { enforceBatchWarnings, findBatchWarnings } from "./batch-rules";
import { CustomerService } from "../customers/customer.service";
import { CreateSaleReturnItemDto } from "./dto/create-salereturnitem.dto";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturnitem.dto";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { AuditService } from "src/core/audit/audit.service";
import { loadStoreProfile } from "../store/store-profile";
import { RETURN_RULES } from "./return-rule";
import { SaleHooks } from "src/core/sale-hooks/sale-hooks";
import { WhatsAppService } from "../whatsapp/whatsapp.service";

import { isManagerRole, NOT_A_PERSON } from 'src/core/roles';
import { correctionProblem } from './sale-correction';
@ApiTags('Sales')
@Controller('sales')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SaleController {

    constructor(private saleService:SaleService, 
      private custService:CustomerService,
      private audit:AuditService,
      private hooks:SaleHooks,
      private whatsapp:WhatsAppService,
      @InjectEntityManager() private manager:EntityManager){}

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
        await this.assertWorksAt(asked, storeId);
      }

      /** the person named as serving must be active and work at the store (the business head and owner-operator work at every store) */
      private async assertWorksAt(asked: number, storeId: number | null): Promise<void> {
        const [who] = await this.manager.query(
          `select r.name from app_user u join app_role r on r.id = u.role_id
            where u.id = $1 and u.active and not u.archive
              and (r.name in ('Business Head', 'Owner-operator') or exists (select 1 from user_stores us where us.user_id = u.id and us.store_id = $2 and us.active and not us.archive))`, [asked, storeId]);
        if (!who || NOT_A_PERSON.includes(who.name)) throw new BadRequestException('That person does not work at this store.');
      }

      /** the store a bill is for: the one it names, else the business's first (same fallback as saving it) */
      /** a Store Head, Business Head or owner (may bill past a customer's credit limit) */
      private async isManagerUser(currentUser: any): Promise<boolean> {
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [currentUser?.roleid || 0]);
        return isManagerRole(role?.name);
      }

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
        
        await this.hooks.check({ manager: this.manager, sale: createSaleDto, customer, storeId: await this.billStore(createSaleDto), userId: currentUser.id });
        const recordBatchOverride = await this.checkBatches(createSaleDto, currentUser);
        const digital = await checkDigitalPayment(this.manager, createSaleDto);
        const staffCredit = await checkStaffCredit(this.manager, createSaleDto, null, await this.billStore(createSaleDto));
        const customerDue = await checkCustomerDue(this.manager, createSaleDto, customer, await this.isManagerUser(currentUser), null, await this.billStore(createSaleDto));
        const storeCredit = await checkStoreCredit(this.manager, createSaleDto, customer);
        const commitment = await checkCommitmentTender(this.manager, { ...createSaleDto, storeid: await this.billStore(createSaleDto) }, customer);
        await this.assertOperatorNamed(createSaleDto, currentUser);
        const actingUserId = await this.resolveActingUser(createSaleDto.actinguserid, currentUser, undefined, await this.billStore(createSaleDto));
        const created = await this.saleService.create({...createSaleDto, ...(digital || {}), ...(staffCredit || {}), ...(customerDue || {}), ...(storeCredit || {}), ...(commitment || {}), customer}, currentUser.id, actingUserId);
        await recordBatchOverride((created as any)?.id ?? null);
        void this.whatsapp.autoSendBill(currentUser, (created as any)?.id);
        return created;
      }

      @Put()
      async update(@Body() updateSaleDto: any, @User() currentUser: any) {
        // the lines the client dropped are removed by the update itself, inside its transaction, after the checks
        const sale = await this.saleService.findById(updateSaleDto.id);

        let customer = updateSaleDto.customer;
        if(customer){ //if customer not present before
          customer = await this.custService.save(updateSaleDto.customer);
        }
        await this.hooks.check({ manager: this.manager, sale: updateSaleDto, customer, storeId: await this.billStore(updateSaleDto), userId: currentUser.id });
        const recordBatchOverride = await this.checkBatches(updateSaleDto, currentUser);
        const digital = await checkDigitalPayment(this.manager, updateSaleDto, updateSaleDto.id);
        const staffCredit = await checkStaffCredit(this.manager, updateSaleDto, updateSaleDto.id, await this.billStore(updateSaleDto));
        const customerDue = await checkCustomerDue(this.manager, updateSaleDto, customer, await this.isManagerUser(currentUser), updateSaleDto.id, await this.billStore(updateSaleDto));
        const storeCredit = await checkStoreCredit(this.manager, updateSaleDto, customer, updateSaleDto.id);
        const commitment = await checkCommitmentTender(this.manager, { ...updateSaleDto, storeid: await this.billStore(updateSaleDto) }, customer, updateSaleDto.id);
        await this.assertOperatorNamed(updateSaleDto, currentUser);
        const actingUserId = await this.resolveActingUser(updateSaleDto.actinguserid, currentUser, updateSaleDto.id, await this.billStore(updateSaleDto));
        const saved = await this.saleService.updateSale({...updateSaleDto, ...(digital || {}), ...(staffCredit || {}), ...(customerDue || {}), ...(storeCredit || {}), ...(commitment || {}), customer}, currentUser.id, actingUserId);
        await this.recordSaleEdit(sale, updateSaleDto, currentUser.id, actingUserId);
        await recordBatchOverride(updateSaleDto.id ?? null);
        void this.whatsapp.autoSendBill(currentUser, updateSaleDto.id);
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
        `select st.id, st.location, st.address, st.pincode, st.phone, st.google_review_url, st.business_id,
                b.name as business_name, b.legal_name, b.gstin, b.state_code, b.address as business_address, b.pincode as business_pincode, b.phone as business_phone, b.logo as business_logo, b.website as business_website, b.grievance_phone as business_grievance_phone, b.bill_show_mrp as business_show_mrp, b.bill_show_saving as business_show_saving, b.bill_show_return_note as business_show_return_note, b.bill_return_note as business_return_note, b.bill_layout as business_bill_layout,
                (select count(*) from stores s2 where s2.business_id = st.business_id and s2.active = true and s2.archive = false)::int as store_count
           from stores st join business b on b.id = st.business_id where st.id = $1`, [sale.store_id]);
      if (!store) return { store: null, business: null, licences: [] };
      const licences = await this.manager.query(
        `select license_type as type, number, valid_to as validto from store_license where store_id = $1 order by id`, [store.id]);
      return {
        business: { name: store.business_name, legalname: store.legal_name, gstin: store.gstin, statecode: store.state_code, address: store.business_address, pincode: store.business_pincode, phone: store.business_phone, logo: store.business_logo, website: store.business_website, grievancephone: store.business_grievance_phone, showmrp: !!store.business_show_mrp, showsaving: store.business_show_saving !== false, showreturnnote: store.business_show_return_note !== false, returnnote: store.business_return_note || null, layout: effectiveBillLayout(store.business_bill_layout) },
        store: { name: store.location, address: store.address, pincode: store.pincode, phone: store.phone, reviewurl: store.google_review_url || null },
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

    /** void a completed bill rung up by mistake, while its shift is open: { reason } */
    @Post(':id/void')
    async voidBill(@Param('id') id: string, @Body() body: any, @User() currentUser: any) {
      const [role] = await this.manager.query(
        `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                         where r.id = $1 and e->>'resource' = 'sales' and p->>'action' = 'void') as can`, [currentUser.roleid]);
      const result = await this.saleService.voidSale(id, body?.reason, currentUser, !!role?.can);
      await this.audit.record({ userId: currentUser.id, action: 'sale.voided', entityType: 'sale', entityId: +id,
        summary: `Bill ${result.billno ?? id} voided: ${`${body?.reason}`.trim()}`, details: { reason: `${body?.reason}`.trim(), cashreversed: result.cashreversed } });
      return result;
    }

    /** a Business Head's force-void of a bill the ordinary void refuses (closed shift, someone else's, no shift): { reason }. The bill stays on record as VOID. */
    @Post(':id/force-void')
    async forceVoidBill(@Param('id') id: string, @Body() body: any, @User() currentUser: any) {
      const [role] = await this.manager.query(
        `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                         where r.id = $1 and e->>'resource' = 'sales' and p->>'action' = 'forcevoid') as can`, [currentUser.roleid]);
      if (!role?.can) throw new ForbiddenException('Only a Business Head or Owner-operator may force-void a bill.');
      const result = await this.saleService.voidSale(id, body?.reason, currentUser, true, true);
      await this.audit.record({ userId: currentUser.id, action: 'sale.force_voided', entityType: 'sale', entityId: +id,
        summary: `Bill ${result.billno ?? id} force-voided: ${`${body?.reason}`.trim()}`, details: { reason: `${body?.reason}`.trim(), cashreversed: result.cashreversed } });
      return result;
    }

    private async canVoidAny(currentUser: any): Promise<boolean> {
      const [role] = await this.manager.query(
        `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                         where r.id = $1 and e->>'resource' = 'sales' and p->>'action' = 'void') as can`, [currentUser.roleid]);
      return !!role?.can;
    }

    /** what a correction screen needs: the bill's payment, who served, the prescription detail, who may be named, and whether it may be corrected now */
    @Get(':id/correction')
    async correctionInfo(@Param('id') id: string, @User() currentUser: any) {
      const [s] = await this.manager.query(
        `select s.id, s.status, s.shift_id, s.store_id, s.bill_no, s.gst_invoice_no, s.total::float8 as total, s.cash_amount::float8 as cash, s.digi_amount::float8 as digi, s.digi_method, s.digi_refno,
                s.acting_user_id, s.created_by, s.more_props, sh.status as shift_status
           from sale s left join store_shifts sh on sh.id = s.shift_id where s.id = $1`, [+id]);
      if (!s) throw new NotFoundException('Bill not found.');
      const [{ n: returns }] = await this.manager.query(`select count(*)::int as n from sale_return_item sri join sale_item si on si.id = sri.sale_item_id where si.sale_id = $1`, [+id]);
      const canAny = await this.canVoidAny(currentUser);
      const problem = correctionProblem({
        status: s.status, shiftId: s.shift_id ? +s.shift_id : null, shiftStatus: s.shift_status, returns,
        isOwn: [s.created_by, s.acting_user_id].some((u: any) => u && +u === +currentUser.id), canCorrectAny: canAny,
      });
      const servers = await this.manager.query(
        `select u.id, u.full_name as fullname from app_user u join app_role r on r.id = u.role_id
          where u.active and not u.archive and r.name <> all($2::text[])
            and (r.name in ('Business Head', 'Owner-operator') or exists (select 1 from user_stores us where us.user_id = u.id and us.store_id = $1 and us.active and not us.archive))
          order by u.full_name`, [s.store_id, NOT_A_PERSON]);
      const kept = typeof s.more_props === 'string' ? JSON.parse(s.more_props || '{}') : (s.more_props || {});
      const scheduled = await this.manager.query(
        `select si.id, p.title, upper(p.more_props->>'schedule') as schedule from sale_item si join product p on p.id = si.product_id
          where si.sale_id = $1 and si.status = 'Complete' and si.active and not si.archive and upper(p.more_props->>'schedule') in ('H', 'H1', 'X')`, [+id]);
      return {
        problem, billno: s.bill_no, total: s.total, cash: s.cash, digital: s.digi, digimethod: s.digi_method, digirefno: s.digi_refno,
        servedby: s.acting_user_id ? +s.acting_user_id : null, servers, taxinvoice: !!s.gst_invoice_no,
        scheduledetail: kept.scheduledetail ?? null, documents: kept.documents ?? [], scheduled: scheduled.map((x: any) => ({ id: +x.id, title: x.title, more_props: { schedule: x.schedule } })),
      };
    }

    /**
     * Correct a completed bill's payment, who served and prescription detail in its open shift: { cashamt, digiamt, digimethod, digirefno, actinguserid, scheduledetail, documents, reason, ack }.
     * Without ack: returns the changes and the warnings and saves nothing. With ack and a reason: saves and audits.
     */
    @Put(':id/correction')
    async correctBill(@Param('id') id: string, @Body() body: any, @User() currentUser: any) {
      const [s] = await this.manager.query(`select store_id from sale where id = $1`, [+id]);
      if (!s) throw new NotFoundException('Bill not found.');
      if (body?.actinguserid) await this.assertWorksAt(Number(body.actinguserid), s.store_id ? +s.store_id : null);
      const result = await this.saleService.correctSale(id, body, currentUser, await this.canVoidAny(currentUser), body?.ack === true);
      if (result.saved) {
        await this.audit.record({ userId: currentUser.id, action: 'sale.details_corrected', entityType: 'sale', entityId: +id,
          summary: `Bill ${result.billno ?? id} corrected (${result.changes.join('; ')}): ${result.reason}`, details: { reason: result.reason, changes: result.changes } });
      }
      return result;
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

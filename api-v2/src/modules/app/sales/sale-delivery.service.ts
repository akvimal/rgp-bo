import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { Sale } from "src/entities/sale.entity";
import { SaleDelivery } from "src/entities/sale-delivery.entity";
import { AuditService } from "src/core/audit/audit.service";
import { isManagerRole, isOwnerRole } from "src/core/roles";
import { StoreService } from "../store/store.service";
import { ExpenseService } from "../expenses/expense.service";
import {
    CASH_EXPENSE_CATEGORY, CostRequest, CostState, DIGITAL_MODES, EXPENSE_CATEGORY_NAME, LINKED_MESSAGE, LOCKED_CASH, LOCKED_DIGITAL, cleanCostRequest, costDescription, planCost,
} from "./delivery-cost-rules";
import { DeliveryRef, EntryRef, matchOf, matchesFor, suggestLinks } from "./delivery-cost-match";
import { deliveryModeProblem } from "./delivery-mode-rule";

@Injectable()
export class SaleDeliveryService {

    constructor(
        @InjectRepository(SaleDelivery) private readonly deliveryRepository: Repository<SaleDelivery>,
        @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
        @InjectEntityManager() private manager: EntityManager,
        private readonly audit: AuditService,
        private readonly store: StoreService,
        private readonly expenses: ExpenseService,
    ) { }

    /** today in India, as a date */
    private istToday(){
        return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    }

    private getToday(){
        return new Date().toISOString().slice(0, 10);
    }

    private toEntityPayload(delivery:any) {
        return {
            saleId: delivery.saleid,
            bookeddate: delivery.bookeddate || this.getToday(),
            bookedby: delivery.bookedby || null,
            receivername: delivery.receivername || null,
            receiverphone: delivery.receiverphone || null,
            receiveraddress: delivery.receiveraddress || null,
            deliverydate: delivery.deliverydate || null,
            deliveryby: delivery.deliveryby || null,
            deliverymethod: delivery.deliverymethod || 'Staff Delivery',
            courierpartner: delivery.courierpartner || null,
            deliveredat: delivery.deliveredat ? new Date(delivery.deliveredat) : null,
            confirmed: !!delivery.confirmed,
            confirmedby: delivery.confirmedby || null,
            confirmedat: delivery.confirmedat ? new Date(delivery.confirmedat) : null,
            charges: delivery.charges ?? 0,
            actualcost: delivery.actualcost ?? 0,
            status: delivery.status || 'Pending',
            paymentmode: delivery.paymentmode || null,
            collectionstatus: delivery.collectionstatus || null,
            failurereason: delivery.failurereason || null,
            comments: delivery.comments || null,
        };
    }

    async save(delivery:any,userid:any, repo: Repository<SaleDelivery> = this.deliveryRepository) {
        const payload = this.toEntityPayload(delivery);
        const existing = await repo.findOne({
            where: { saleId: payload.saleId },
        });

        const entity = existing
            ? repo.merge(existing, {
                ...payload,
                updatedby: userid,
              })
            : repo.create({
                ...payload,
                bookedby: payload.bookedby || userid,
                createdby: userid,
                updatedby: userid,
              });

        return repo.save(entity);
    }

    /**
     * Turns a completed bill into a delivery (or back into a counter sale) after it was rung. The money is not touched: the bill was paid, or left
     * to pay later, when it was made, so the delivery is booked as already collected and never shows as cash to collect on the doorstep.
     */
    async changeMode(saleid: number, body: any, user: { id: number; roleid?: number }) {
        const target = String(body?.type || '');
        return this.manager.transaction(async (tm) => {
            const [sale] = await tm.query(
                `select s.id, s.status, s.delivery_type, s.shift_id, s.bill_no, s.created_by, s.acting_user_id, s.customer_id, sh.status as shift_status,
                        (select d.status from sale_deliveries d where d."saleId" = s.id) as delivery_status
                   from sale s left join store_shifts sh on sh.id = s.shift_id where s.id = $1 for update of s`, [saleid]);
            if (!sale) throw new NotFoundException('Bill not found.');
            const [role] = await tm.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
            const problem = deliveryModeProblem({
                status: sale.status, currentType: sale.delivery_type, target, shiftId: sale.shift_id ? +sale.shift_id : null, shiftStatus: sale.shift_status,
                deliveryStatus: sale.delivery_status, isOwn: [sale.created_by, sale.acting_user_id].some((u: any) => u && +u === +user.id),
                isManager: isManagerRole(role?.name), outsideState: body?.outsidestate === true, reason: body?.reason,
            });
            if (problem) throw new BadRequestException(problem);
            const before = sale.delivery_type || 'Counter';
            await tm.query(`update sale set delivery_type = $2, updated_by = $3, updated_on = now() where id = $1`, [saleid, target, user.id]);

            if (target === 'Delivery') {
                const d = body?.delivery || {};
                const delivered = d.delivered === true;
                const [cust] = sale.customer_id ? await tm.query(`select name, mobile, address from customer where id = $1`, [sale.customer_id]) : [null];
                await this.save({
                    saleid,
                    receivername: String(d.receivername || cust?.name || '').trim() || null,
                    receiverphone: String(d.receiverphone || cust?.mobile || '').trim() || null,
                    receiveraddress: String(d.receiveraddress || cust?.address || '').trim() || null,
                    deliveryby: String(d.deliveryby || '').trim() || null,
                    deliverymethod: d.deliverymethod === 'Courier' ? 'Courier' : 'Staff Delivery',
                    courierpartner: d.deliverymethod === 'Courier' ? (String(d.courierpartner || '').trim() || null) : null,
                    charges: Math.max(0, Number(d.charges) || 0),
                    // paid when the bill was made: nothing to collect at the door
                    paymentmode: 'Paid at counter', collectionstatus: 'Collected',
                    status: delivered ? 'Delivered' : 'Pending',
                    deliverydate: this.getToday(), deliveredat: delivered ? new Date() : null,
                    comments: String(d.comments || '').trim() || null,
                }, user.id, tm.getRepository(SaleDelivery));
            } else {
                await tm.query(`delete from sale_deliveries where "saleId" = $1`, [saleid]);
            }
            await this.audit.record({
                userId: user.id, action: 'sale.delivery_mode_changed', entityType: 'sales', entityId: saleid,
                summary: `Bill ${sale.bill_no ?? saleid} changed from ${before === 'Delivery' ? 'a delivery' : 'a counter sale'} to ${target === 'Delivery' ? 'a delivery' : 'a counter sale'}${body?.reason ? ` (${String(body.reason).trim().slice(0, 150)})` : ''}`,
                details: { from: before, to: target, reason: body?.reason ?? null },
            });
            return { id: saleid, deliverytype: target };
        });
    }

    /**
     * Recent completed bills that are not deliveries yet, for "new delivery" on the Deliveries page. A Store Head / Business Head sees every bill of
     * the store; anyone else sees only the bills they rang. Making one a delivery goes through changeMode, which checks the same rules again.
     */
    async candidates(query: any, user: { id: number; roleid?: number }) {
        const days = Math.min(Math.max(Math.floor(Number(query?.days)) || 3, 1), 30);
        const storeId = query?.storeid ? Number(query.storeid) : null;
        const q = String(query?.q || '').trim();
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
        const manager = isManagerRole(role?.name);
        return this.manager.query(
            `select s.id, s.bill_no as billno, s.bill_date as billdate, s.total, s.order_type as ordertype, coalesce(s.delivery_type, 'Counter') as deliverytype,
                    c.name as custname, c.mobile as custmobile
               from sale s left join customer c on c.id = s.customer_id
              where s.status = 'COMPLETE' and coalesce(s.delivery_type, 'Counter') <> 'Delivery'
                and s.bill_date >= now() - ($1::int * interval '1 day')
                and ($2::int is null or s.store_id = $2)
                and ($3::boolean or s.created_by = $4 or s.acting_user_id = $4)
                and ($5 = '' or s.bill_no::text = $5 or c.name ilike '%' || $5 || '%' or c.mobile like '%' || $5 || '%')
              order by s.bill_date desc limit 100`,
            [days, storeId, manager, user.id, q]);
    }

    async findAll(query:any,userid:any){
        const qb = this.saleRepository.createQueryBuilder("sale")
                .leftJoinAndSelect("sale.delivery", "delivery")
                .leftJoinAndSelect("sale.customer", "customer")
                .leftJoinAndSelect("sale.created", "created")
                .select([
                    'sale',
                    'delivery',
                    'customer.id',
                    'customer.name',
                    'customer.mobile',
                    'customer.address',
                    'created.id',
                    'created.fullname'
                ])
                .where("sale.deliverytype = :deliveryType", { deliveryType: 'Delivery' })
                .andWhere("sale.status = :status", { status: 'COMPLETE' })
                .orderBy("sale.billdate", "DESC");

        if(userid){
            qb.andWhere("sale.created_by = :userid", { userid });
        }

        const sales = await qb.getMany();

        // what is behind each delivery's cost: the entry it made or was linked to, and whether it can still change
        const cashIds = sales.map((x:any) => x.delivery?.cashentryid).filter((x:any) => !!x);
        const expIds = sales.map((x:any) => x.delivery?.expenseid).filter((x:any) => !!x);
        const cashRows = cashIds.length ? await this.manager.query(
            `select l.id, to_char(l.trans_date, 'YYYY-MM-DD') as day, l.description, sh.status as shift_status, sh.name as shift_name
               from store_cash_accounts l left join store_shifts sh on sh.id = l.shift_id where l.id = any($1::int[])`, [cashIds]) : [];
        const expRows = expIds.length ? await this.manager.query(
            `select e.id, to_char(e.expense_date, 'YYYY-MM-DD') as day, e.pay_mode, e.status, e.payee from expense e where e.id = any($1::int[])`, [expIds]) : [];
        const cashBy = new Map<number, any>(cashRows.map((r:any) => [+r.id, r]));
        const expBy = new Map<number, any>(expRows.map((r:any) => [+r.id, r]));
        const costInfo = (d:any) => {
            if(d.cashentryid){
                const c = cashBy.get(+d.cashentryid);
                const locked = d.costlinked || !c || c.shift_status !== 'OPEN';
                return { costentry: c ? `Cash entry #${d.cashentryid}, ${c.day}${c.shift_name ? ', ' + c.shift_name + ' shift' : ''}` : `Cash entry #${d.cashentryid}`, costlocked: !!locked,
                    costlockreason: d.costlinked ? LINKED_MESSAGE : locked ? LOCKED_CASH : null, expensestatus: null };
            }
            if(d.expenseid){
                const e = expBy.get(+d.expenseid);
                const locked = d.costlinked || !e || e.status !== 'PENDING';
                return { costentry: e ? `Expense #${d.expenseid}, ${e.day}${e.pay_mode ? ', ' + e.pay_mode : ''}, ${String(e.status).toLowerCase()}` : `Expense #${d.expenseid}`, costlocked: !!locked,
                    costlockreason: d.costlinked ? LINKED_MESSAGE : locked ? LOCKED_DIGITAL : null, expensestatus: e?.status || null };
            }
            return { costentry: '', costlocked: false, costlockreason: null, expensestatus: null };
        };

        return sales.map((sale:any) => {
            const delivery = sale.delivery || {};
            return {
                id: delivery.id || null,
                saleid: sale.id,
                bookeddate: delivery.bookeddate || sale.billdate,
                bookedby: delivery.bookedby || sale.created?.id || null,
                receivername: delivery.receivername || sale.customer?.name || '',
                receiverphone: delivery.receiverphone || sale.customer?.mobile || '',
                receiveraddress: delivery.receiveraddress || sale.customer?.address || '',
                deliverydate: delivery.deliverydate || null,
                deliveryby: delivery.deliveryby || '',
                deliverymethod: delivery.deliverymethod || 'Staff Delivery',
                courierpartner: delivery.courierpartner || '',
                deliveredat: delivery.deliveredat || null,
                confirmed: delivery.confirmed || false,
                confirmedby: delivery.confirmedby || '',
                confirmedat: delivery.confirmedat || null,
                charges: delivery.charges ?? 0,
                actualcost: delivery.actualcost ?? 0,
                status: delivery.status || 'Pending',
                paymentmode: delivery.paymentmode || '',
                collectionstatus: delivery.collectionstatus || '',
                failurereason: delivery.failurereason || '',
                comments: delivery.comments || '',
                storeid: sale.storeid ?? null,
                costpaidvia: delivery.costpaidvia || '',
                costpaidmode: delivery.costpaidmode || '',
                costpaidref: delivery.costpaidref || '',
                cashentryid: delivery.cashentryid || null,
                expenseid: delivery.expenseid || null,
                costlinked: !!delivery.costlinked,
                confirmedbyuser: delivery.confirmedbyuser || null,
                ...costInfo(delivery),
                saleperson: sale.created?.fullname || '',
                sale,
            };
        });
    }

    // ------------------------------------------------------------------------------------------------ what a delivery cost, and how it was paid

    /** who the person may act for: every store for an owner, their own stores for anyone else */
    private async scopeOf(user:any): Promise<{ owner: boolean; stores: number[] }> {
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
        if(isOwnerRole(role?.name)) return { owner: true, stores: [] };
        const mine = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
        return { owner: false, stores: mine.map((m:any) => +m.store_id) };
    }

    private assertStore(scope:{ owner: boolean; stores: number[] }, storeId:number|null){
        if(!scope.owner && (storeId === null || !scope.stores.includes(+storeId))) throw new ForbiddenException('That delivery is at a store you do not work at.');
    }

    /** the entries already recorded that could be a delivery's cost and are not another delivery's: the cash drawer's expenses and the Expenses ledger */
    private async freeEntries(storeId:number|null, from:string, to:string, owner = true, stores:number[] = []): Promise<(EntryRef & { raw: any })[]> {
        const storeSql = (col:string) => storeId !== null ? `and (${col} = ${Number(storeId)} or ${col} is null)` : owner ? '' : `and ${col} = any(array[${stores.map(Number).join(',') || '0'}]::int[])`;
        const cash = await this.manager.query(
            `select l.id, l.store_id, l.withdraw::float as amount, to_char(l.trans_date, 'YYYY-MM-DD') as day, l.description, l.expense_category, sh.name as shift_name, sh.status as shift_status
               from store_cash_accounts l left join store_shifts sh on sh.id = l.shift_id
              where l.category = 'EXPENSE' and l.trans_date between $1::date and $2::date ${storeSql('l.store_id')}
                and not exists (select 1 from sale_deliveries d where d.cash_entry_id = l.id)`, [from, to]);
        const exp = await this.manager.query(
            `select e.id, e.store_id, e.amount::float as amount, to_char(e.expense_date, 'YYYY-MM-DD') as day, e.payee, e.bill_no, e.description, e.pay_mode, e.status, k.name as category
               from expense e join expense_category k on k.id = e.category_id
              where e.status in ('PENDING', 'APPROVED') and e.expense_date between $1::date and $2::date ${storeSql('e.store_id')}
                and not exists (select 1 from sale_deliveries d where d.expense_id = e.id)`, [from, to]);
        return [
            ...cash.map((r:any) => ({ kind: 'CASH' as const, id: +r.id, storeId: r.store_id === null ? null : +r.store_id, amount: +r.amount, day: r.day, text: r.description || '',
                categoryHint: r.expense_category === CASH_EXPENSE_CATEGORY, raw: { ...r, label: `Cash drawer, ${r.shift_name ? r.shift_name + ' shift' : 'no shift'}` } })),
            ...exp.map((r:any) => ({ kind: 'DIGITAL' as const, id: +r.id, storeId: r.store_id === null ? null : +r.store_id, amount: +r.amount, day: r.day,
                text: [r.payee, r.bill_no, r.description].filter(Boolean).join(' '), categoryHint: r.category === EXPENSE_CATEGORY_NAME, raw: { ...r, label: `Expense, ${r.pay_mode}, ${String(r.status).toLowerCase()}` } })),
        ];
    }

    private refOf(r:any): DeliveryRef {
        return {
            saleId: +r.sale_id, billNo: r.bill_no, storeId: r.store_id === null ? null : +r.store_id, cost: +r.actual_cost || 0, day: String(r.day).slice(0, 10),
            receiver: r.receiver_name || r.customer_name || null, by: r.delivery_by || null, partner: r.courier_partner || null,
        };
    }

    private static readonly DELIVERY_ROWS = `select d."saleId" as sale_id, s.bill_no, s.store_id, d.actual_cost, d.receiver_name, d.delivery_by, d.courier_partner, c.name as customer_name,
               to_char(coalesce(d.delivered_at::date, d.delivery_date, d.booked_date, s.bill_date::date), 'YYYY-MM-DD') as day
          from sale_deliveries d join sale s on s.id = d."saleId" left join customer c on c.id = s.customer_id`;

    /**
     * Which drawer a cash payment would come from: the person's own open shift (or the store's one open shift), shown on the Manage screen; and, for a Store Head or
     * above, the store's other open shifts to choose from (only where there is something to choose: several drawers open, or none of their own).
     */
    async cashShifts(saleid:number, user:any){
        const scope = await this.scopeOf(user);
        const [sale] = await this.manager.query(`select s.id, s.store_id from sale s where s.id = $1`, [saleid]);
        if(!sale) throw new NotFoundException('That bill was not found.');
        if(sale.store_id === null) return { shift: null, shifts: [], canChoose: false };
        this.assertStore(scope, +sale.store_id);
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
        const shifts = await this.manager.query(
            `select sh.id, sh.name, sh.opened_on, to_char(sh.shift_date, 'YYYY-MM-DD') as shift_date, ob.full_name as opened_by, ac.full_name as accountable
               from store_shifts sh left join app_user ob on ob.id = sh.opened_by left join app_user ac on ac.id = coalesce(sh.accountable_user_id, sh.assigned_user_id)
              where sh.store_id = $1 and sh.status = 'OPEN' and not sh.archive order by sh.id`, [sale.store_id]);
        const own = await this.store.findOpenShiftFor(+sale.store_id, user.id);
        const rows = shifts.map((r:any) => ({ id: +r.id, name: r.name, openedon: r.opened_on, shiftdate: r.shift_date, openedby: r.opened_by || null, accountable: r.accountable || null, mine: !!own && +own.id === +r.id }));
        const canChoose = isManagerRole(role?.name) && rows.length > 0 && (rows.length > 1 || !own);
        return { shift: rows.find((r:any) => r.mine) || null, shifts: canChoose ? rows : [], canChoose };
    }

    /** the entries a delivery's cost could be: around its day at its store, the exact amounts first (for the Manage screen, to link instead of paying again) */
    async costCandidates(saleid:number, user:any){
        const scope = await this.scopeOf(user);
        const [row] = await this.manager.query(`${SaleDeliveryService.DELIVERY_ROWS} where d."saleId" = $1`, [saleid]);
        const [sale] = row ? [row] : await this.manager.query(
            `select s.id as sale_id, s.bill_no, s.store_id, 0 as actual_cost, null as receiver_name, null as delivery_by, null as courier_partner, c.name as customer_name, to_char(s.bill_date::date, 'YYYY-MM-DD') as day
               from sale s left join customer c on c.id = s.customer_id where s.id = $1`, [saleid]);
        if(!sale) throw new NotFoundException('That bill was not found.');
        this.assertStore(scope, sale.store_id === null ? null : +sale.store_id);
        const ref = this.refOf(sale);
        const day = ref.day;
        const from = new Date(Date.parse(day + 'T00:00:00Z') - 14 * 86400000).toISOString().slice(0, 10);
        const to = new Date(Date.parse(day + 'T00:00:00Z') + 14 * 86400000).toISOString().slice(0, 10);
        const entries = await this.freeEntries(ref.storeId, from, to, scope.owner, scope.stores);
        const out = entries.map((e) => {
            const m = ref.cost > 0 ? matchOf(ref, e) : null;
            return { kind: e.kind, id: e.id, day: e.day, amount: e.amount, text: e.text, label: e.raw.label, storeid: e.storeId, exact: !!m, level: m?.level ?? null, reasons: m?.reasons ?? [], daysapart: Math.abs(Math.round((Date.parse(e.day + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 86400000)) };
        }).sort((a, b) => (a.exact === b.exact ? (a.level === b.level ? a.daysapart - b.daysapart : a.level === 'sure' ? -1 : 1) : a.exact ? -1 : 1)).slice(0, 30);
        return { saleid, cost: ref.cost, day, candidates: out };
    }

    /** deliveries with a cost that is not linked to an expense, and the pairs that can safely be linked in one go (the rest are left to be decided one by one) */
    async costSuggestions(query:any, user:any){
        const scope = await this.scopeOf(user);
        const days = Math.min(365, Math.max(7, Number(query?.days) || 120));
        const from = new Date(Date.now() + 5.5 * 3600000 - days * 86400000).toISOString().slice(0, 10);
        const rows = await this.manager.query(
            `${SaleDeliveryService.DELIVERY_ROWS} where d.actual_cost > 0 and d.cost_paid_via is null and d.cash_entry_id is null and d.expense_id is null
               and s.status = 'COMPLETE' and coalesce(d.delivered_at::date, d.delivery_date, d.booked_date, s.bill_date::date) >= $1::date`, [from]);
        const mine = rows.filter((r:any) => scope.owner || (r.store_id !== null && scope.stores.includes(+r.store_id)));
        const deliveries = mine.map((r:any) => this.refOf(r));
        if(!deliveries.length) return { unlinked: 0, pairs: [], undecided: 0 };
        const dayFrom = new Date(Date.parse(deliveries.reduce((m:string, d:any) => (d.day < m ? d.day : m), deliveries[0].day) + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
        const entries = await this.freeEntries(null, dayFrom, this.istToday(), scope.owner, scope.stores);
        const result = suggestLinks(deliveries, entries);
        const entryBy = new Map(entries.map((e) => [`${e.kind}:${e.id}`, e]));
        const delBy = new Map<number, any>(mine.map((r:any) => [+r.sale_id, r]));
        return {
            unlinked: deliveries.length, undecided: result.undecided,
            pairs: result.pairs.map((m) => {
                const d = delBy.get(m.saleId); const e = entryBy.get(`${m.kind}:${m.entryId}`)!;
                return { saleid: m.saleId, billno: d.bill_no, receiver: d.receiver_name || d.customer_name || '', cost: +d.actual_cost, deliveryday: String(d.day).slice(0, 10),
                    kind: m.kind, entryid: m.entryId, entryday: e.day, entrytext: e.text, entrylabel: e.raw.label, daysapart: m.days, reasons: m.reasons };
            }),
        };
    }

    /** checks an entry may be linked to a delivery, and what the link records */
    private async resolveLink(kind:'CASH'|'DIGITAL', id:number, sale:{ id:number; store_id:number|null }, scope:{ owner:boolean; stores:number[] }){
        if(kind === 'CASH'){
            const [e] = await this.manager.query(`select id, store_id, withdraw::float as amount, category from store_cash_accounts where id = $1`, [id]);
            if(!e || e.category !== 'EXPENSE') throw new BadRequestException('That cash entry is not an expense.');
            if(e.store_id !== null && sale.store_id !== null && +e.store_id !== +sale.store_id) throw new BadRequestException('That entry is at another store.');
            this.assertStore(scope, e.store_id === null ? null : +e.store_id);
            const [taken] = await this.manager.query(`select "saleId" from sale_deliveries where cash_entry_id = $1 and "saleId" <> $2`, [id, sale.id]);
            if(taken) throw new ConflictException('That entry is already the cost of another delivery.');
            return { amount: +e.amount, via: 'CASH' as const, mode: null as string | null, ref: null as string | null };
        }
        const [e] = await this.manager.query(`select id, store_id, amount::float as amount, pay_mode, bill_no, status from expense where id = $1`, [id]);
        if(!e) throw new NotFoundException('That expense was not found.');
        if(e.status === 'REJECTED' || e.status === 'CANCELLED') throw new BadRequestException('That expense was not approved.');
        if(e.store_id !== null && sale.store_id !== null && +e.store_id !== +sale.store_id) throw new BadRequestException('That expense is at another store.');
        if(e.store_id !== null) this.assertStore(scope, +e.store_id);
        const [taken] = await this.manager.query(`select "saleId" from sale_deliveries where expense_id = $1 and "saleId" <> $2`, [id, sale.id]);
        if(taken) throw new ConflictException('That expense is already the cost of another delivery.');
        const mode = String(e.pay_mode || '').toUpperCase();
        return { amount: +e.amount, via: (mode === 'CASH' ? 'CASH' : 'DIGITAL') as 'CASH' | 'DIGITAL', mode: (DIGITAL_MODES as readonly string[]).includes(mode) ? mode : null, ref: e.bill_no ? String(e.bill_no).slice(0, 60) : null };
    }

    /** links entries already recorded to deliveries, in one go (the suggestions that were accepted): nothing is posted or changed on the ledgers */
    async linkCosts(body:any, user:any){
        const links: { saleid:number; kind:string; entryid:number }[] = Array.isArray(body?.links) ? body.links.slice(0, 200) : [];
        if(!links.length) throw new BadRequestException('Choose at least one delivery to link.');
        const scope = await this.scopeOf(user);
        const done: number[] = [], skipped: { saleid:number; why:string }[] = [];
        for(const l of links){
            try {
                const kind = String(l.kind).toUpperCase() === 'CASH' ? 'CASH' : String(l.kind).toUpperCase() === 'DIGITAL' ? 'DIGITAL' : null;
                if(!kind) throw new BadRequestException('Say whether the entry is a cash entry or an expense.');
                const [sale] = await this.manager.query(`select s.id, s.store_id, d.actual_cost, d.cash_entry_id, d.expense_id, d.cost_paid_via from sale s join sale_deliveries d on d."saleId" = s.id where s.id = $1`, [Number(l.saleid)]);
                if(!sale) throw new NotFoundException('That delivery was not found.');
                this.assertStore(scope, sale.store_id === null ? null : +sale.store_id);
                if(sale.cash_entry_id || sale.expense_id || sale.cost_paid_via) throw new ConflictException('That delivery already has its cost recorded.');
                const r = await this.resolveLink(kind, Number(l.entryid), { id: +sale.id, store_id: sale.store_id }, scope);
                if(Math.abs(+sale.actual_cost - r.amount) >= 0.005) throw new ConflictException(`The amounts differ (delivery ${(+sale.actual_cost).toFixed(2)}, entry ${r.amount.toFixed(2)}): link it from the delivery.`);
                await this.manager.query(
                    `update sale_deliveries set cost_paid_via = $2, cost_paid_mode = $3, cost_paid_ref = $4, cost_paid_on = now(), cost_paid_by = $5, cash_entry_id = $6, expense_id = $7, cost_linked = true, updated_by = $5, updated_on = now()
                      where "saleId" = $1`, [sale.id, r.via, r.mode, r.ref, user.id, kind === 'CASH' ? Number(l.entryid) : null, kind === 'DIGITAL' ? Number(l.entryid) : null]);
                done.push(+sale.id);
            } catch(e:any){ skipped.push({ saleid: Number(l.saleid), why: e?.response?.message || e?.message || 'Not linked.' }); }
        }
        if(done.length) await this.audit.record({ userId: user.id, action: 'delivery.costs_linked', summary: `${done.length} delivery cost${done.length === 1 ? '' : 's'} linked to expenses already recorded`, details: { saleids: done } });
        return { linked: done.length, skipped };
    }

    /**
     * The delivery as the Manage screen saves it: the delivery itself; who confirmed it (the person logged in, unless another was named); and how its cost
     * was paid: cash from the counter (an entry on the open shift's ledger), digitally (an expense), not yet, no cost, or linked to an entry that was already
     * recorded. The cost is posted once, a later change updates the same entry, and one that can no longer change is refused rather than altered.
     */
    async update(dto:any, user:any){
        const saleId = Number(dto.saleid);
        const [sale] = await this.manager.query(`select s.id, s.bill_no, s.store_id from sale s where s.id = $1`, [saleId]);
        if(!sale) throw new NotFoundException('That bill was not found.');
        const existing = await this.deliveryRepository.findOne({ where: { saleId } });
        const payload:any = this.toEntityPayload({ ...dto, saleid: saleId });
        const [me] = await this.manager.query(`select full_name from app_user where id = $1`, [user.id]);
        if(payload.status === 'Delivered' || payload.confirmed){
            payload.confirmed = true;
            payload.confirmedby = payload.confirmedby || me?.full_name || null;
            payload.confirmedbyuser = payload.confirmedby === me?.full_name ? user.id : (existing?.confirmedbyuser ?? null);
        }
        const asked = cleanCostRequest(dto.costpaid, payload.actualcost);
        if(!asked.ok) throw new BadRequestException(asked.message);

        let cost: { fields: any; warning: string | null; posted: { kind: 'CASH' | 'DIGITAL'; id: number }[]; actualcost?: number } = { fields: {}, warning: null, posted: [] };
        if(asked.req) cost = await this.applyCost(existing, asked.req, sale, payload, user, me?.full_name ?? null, dto.costpaid?.adopt === true);
        if(cost.actualcost !== undefined) payload.actualcost = cost.actualcost;

        let saved:any;
        try {
            const entity = existing
                ? this.deliveryRepository.merge(existing, { ...payload, ...cost.fields, updatedby: user.id })
                : this.deliveryRepository.create({ ...payload, ...cost.fields, bookedby: payload.bookedby || user.id, createdby: user.id, updatedby: user.id } as any) as unknown as SaleDelivery;
            saved = await this.deliveryRepository.save(entity);
        } catch(e){
            // the entries just made would be left without a delivery: take them back
            for(const x of cost.posted){ try { x.kind === 'CASH' ? await this.store.removeLedger(x.id) : await this.expenses.remove(x.id, user); } catch { /* best effort */ } }
            throw e;
        }
        // the time it was delivered and confirmed, in the shop's own clock, when none was given
        await this.manager.query(`update sale_deliveries set delivered_at = coalesce(delivered_at, now() at time zone 'Asia/Kolkata') where "saleId" = $1 and status = 'Delivered'`, [saleId]);
        await this.manager.query(`update sale_deliveries set confirmed_at = coalesce(confirmed_at, now() at time zone 'Asia/Kolkata') where "saleId" = $1 and confirmed`, [saleId]);
        if(asked.req) await this.audit.record({ userId: user.id, action: 'delivery.cost', entityType: 'sale', entityId: saleId, summary: `Delivery #${sale.bill_no} cost ${asked.req.link ? 'linked to an existing entry' : asked.req.via.toLowerCase()}`, details: { via: asked.req.via, amount: payload.actualcost, link: asked.req.link } });
        return Object.assign(saved, { costwarning: cost.warning });
    }

    private async applyCost(existing:SaleDelivery|null, req:CostRequest, sale:any, payload:any, user:any, userName:string|null, adopt:boolean){
        const scope = await this.scopeOf(user);
        const state: CostState = {
            via: existing?.costpaidvia ?? null, amount: existing?.actualcost ?? null, mode: existing?.costpaidmode ?? null, cashEntryId: existing?.cashentryid ?? null,
            expenseId: existing?.expenseid ?? null, cashEditable: false, expenseEditable: false, linked: !!existing?.costlinked,
        };
        if(state.cashEntryId){ const st = await this.store.ledgerEntryState(state.cashEntryId); if(st) state.cashEditable = st.shiftOpen; else state.cashEntryId = null; }
        if(state.expenseId){ const [e] = await this.manager.query(`select status from expense where id = $1`, [state.expenseId]); if(e) state.expenseEditable = e.status === 'PENDING'; else state.expenseId = null; }

        const steps = planCost(state, req);
        const refused = steps.find((x) => x.do === 'refuse');
        if(refused && refused.do === 'refuse') throw new ConflictException(refused.message);

        const posted: { kind: 'CASH' | 'DIGITAL'; id: number }[] = [];
        let cashId = state.cashEntryId, expenseId = state.expenseId, linked = state.linked;
        let amount = req.amount, via: string = req.via, mode = req.mode, ref = req.ref;
        let warning: string | null = null, actualcost: number | undefined;
        const description = costDescription(sale.bill_no, payload.receivername || null, payload.deliveryby || payload.courierpartner || userName);
        let touched = false;

        for(const step of steps){
            if(step.do === 'none') continue;
            touched = true;
            if(step.do === 'reverse'){
                if(!step.unlinkOnly){
                    if(step.kind === 'CASH' && cashId) await this.store.removeLedger(cashId);
                    if(step.kind === 'DIGITAL' && expenseId) await this.expenses.remove(expenseId, user);
                }
                if(step.kind === 'CASH') cashId = null; else expenseId = null;
                linked = false;
            } else if(step.do === 'post' && step.via === 'CASH'){
                if(sale.store_id === null) throw new BadRequestException('This bill has no store, so the cost cannot go on a shift.');
                let shift:any = null;
                if(req.shiftId){
                    // a Store Head or above may pay from another open shift at the store; anybody else pays from their own
                    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
                    const [chosen] = await this.manager.query(`select id, assigned_user_id from store_shifts where id = $1 and store_id = $2 and status = 'OPEN' and not archive`, [req.shiftId, sale.store_id]);
                    if(!chosen) throw new BadRequestException('That shift is not open at this store.');
                    const own = await this.store.findOpenShiftFor(+sale.store_id, user.id);
                    if(!isManagerRole(role?.name) && !(own && +own.id === +chosen.id)) throw new ForbiddenException('Only a Store Head or above can pay from another shift.');
                    shift = chosen;
                } else {
                    shift = await this.store.findOpenShiftFor(+sale.store_id, user.id);
                }
                if(!shift) throw new BadRequestException('No shift is open at this store for you. Open a shift first, or choose another way to pay.');
                const maybe = await this.possibleDuplicates(sale, amount, payload);
                const rec:any = await this.store.saveLedger({ storeid: +sale.store_id, shiftid: shift.id, category: 'EXPENSE', expensecategory: CASH_EXPENSE_CATEGORY, withdraw: amount, description, transdate: this.istToday() }, user.id);
                cashId = +rec.id; posted.push({ kind: 'CASH', id: cashId }); linked = false;
                const expected = await this.store.shiftExpectedCash(shift.id);
                warning = [maybe, expected < 0 ? `The drawer is now expected to be short by ${Math.abs(expected).toFixed(2)}: check the cash.` : null].filter(Boolean).join(' ') || null;
            } else if(step.do === 'post'){
                const [cat] = await this.manager.query(`select id from expense_category where name = $1 and active`, [EXPENSE_CATEGORY_NAME]);
                if(!cat) throw new BadRequestException(`There is no expense category called "${EXPENSE_CATEGORY_NAME}". Add it under Expenses first.`);
                const maybe = await this.possibleDuplicates(sale, amount, payload);
                const r:any = await this.expenses.raise({ expense_date: this.istToday(), store_id: sale.store_id, category_id: cat.id, amount, pay_mode: mode, payee: payload.courierpartner || payload.deliveryby || null, bill_no: ref, description }, user);
                expenseId = +r.id; posted.push({ kind: 'DIGITAL', id: expenseId }); linked = false;
                warning = [maybe, r.status === 'PENDING' ? 'The payment is waiting for the Store Head to approve it as an expense.' : null].filter(Boolean).join(' ') || null;
            } else if(step.do === 'update' && step.via === 'CASH'){
                await this.store.changeLedgerAmount(cashId!, amount, description);
            } else if(step.do === 'update'){
                const [old] = await this.manager.query(`select to_char(expense_date, 'YYYY-MM-DD') as expense_date, store_id, category_id, gst_amount from expense where id = $1`, [expenseId]);
                await this.expenses.update(expenseId!, { ...old, amount, pay_mode: mode, payee: payload.courierpartner || payload.deliveryby || null, bill_no: ref, description }, user);
            } else if(step.do === 'link'){
                const r = await this.resolveLink(step.kind, step.id, { id: +sale.id, store_id: sale.store_id }, scope);
                const wanted = Number(payload.actualcost) || 0;
                if(wanted > 0 && Math.abs(wanted - r.amount) >= 0.005 && !adopt) throw new ConflictException(`The amounts differ (delivery ${wanted.toFixed(2)}, entry ${r.amount.toFixed(2)}). Use the entry's amount, or correct the cost first.`);
                actualcost = r.amount; amount = r.amount; via = r.via; mode = r.mode; ref = r.ref;
                if(step.kind === 'CASH') { cashId = step.id; expenseId = null; } else { expenseId = step.id; cashId = null; }
                linked = true;
            }
        }

        const fields: any = {};
        if(req.via === 'UNPAID' || req.via === 'NONE'){
            Object.assign(fields, { costpaidvia: req.via, costpaidmode: null, costpaidref: null, costpaidon: new Date(), costpaidby: user.id, cashentryid: null, expenseid: null, costlinked: false });
            if(req.via === 'NONE') actualcost = 0;
        } else if(touched){
            Object.assign(fields, { costpaidvia: via, costpaidmode: mode, costpaidref: ref, costpaidon: new Date(), costpaidby: user.id, cashentryid: cashId, expenseid: expenseId, costlinked: linked });
        }
        return { fields, warning, posted, actualcost };
    }

    /** a warning when an entry like this one (same amount, around the same day, at the store) is already recorded and not linked: it may be the same cost */
    private async possibleDuplicates(sale:any, amount:number, payload:any): Promise<string | null> {
        const day = this.istToday();
        const from = new Date(Date.parse(day + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
        const entries = await this.freeEntries(sale.store_id === null ? null : +sale.store_id, from, day);
        const ref: DeliveryRef = { saleId: +sale.id, billNo: sale.bill_no, storeId: sale.store_id === null ? null : +sale.store_id, cost: amount, day, receiver: payload.receivername || null, by: payload.deliveryby || null, partner: payload.courierpartner || null };
        const n = matchesFor(ref, entries).length;
        return n ? `There ${n === 1 ? 'is' : 'are'} already ${n} recorded expense${n === 1 ? '' : 's'} of ${amount.toFixed(2)} around this date that ${n === 1 ? 'is' : 'are'} not linked to a delivery: check the Expenses and Cash screens so the cost is not counted twice.` : null;
    }

    async delete(id:any){
        await this.deliveryRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.delete(SaleDelivery, id);
        });
    } 
    
}

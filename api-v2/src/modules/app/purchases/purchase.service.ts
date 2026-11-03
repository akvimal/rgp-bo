import { assertVendorUsable } from "../vendors/vendor-guard";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreatePurchaseOrderDto } from "./dto/create-order.dto";
import { CreatePurchaseRequestDto } from "./dto/create-request.dto";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { AppRole } from "src/entities/approle.entity";
import { Setting } from "src/entities/setting.entity";
import { Vendor } from "src/entities/vendor.entity";
import { approvalModeFor } from "src/core/approval-mode";

const UNLISTED_NOT_ORDERABLE = 'This request is for a product that is not in the product list yet. Link it to a product (or create the product) before it is ordered.';

@Injectable()
export class PurchaseService {

    constructor(@InjectRepository(PurchaseRequest) private readonly requestRepository: Repository<PurchaseRequest>,
            @InjectRepository(PurchaseOrder) private readonly orderRepository: Repository<PurchaseOrder>,
            @InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>,
            @InjectRepository(Setting) private readonly settingRepository: Repository<Setting>,
            @InjectRepository(Vendor) private readonly vendorRepository: Repository<Vendor>,
            @InjectEntityManager() private manager: EntityManager) { }

    /** what a request-only role (Sales Staff) is allowed to see of a request: no vendor, no internal notes */
    private forRequester(rows: any[]) {
        return rows.map((r) => ({ ...r, vendor: null, vendorid: null, notes: null }));
    }

    async findAllRequests(query: { status?: string; source?: string; priority?: string; vendorid?: number | string }, ownerId?: number) {
        const qb = this.requestRepository.createQueryBuilder('req')
        .leftJoinAndSelect("req.product", "product")
        .leftJoinAndSelect("req.vendor", "vendor")
        .leftJoinAndSelect("req.po", "po")
        .select(['req','product','vendor.id','vendor.name','po.id','po.status'])
        .where('req.isActive = :flag', { flag: true });

        if(query.status){
            qb.andWhere('req.status = :status', { status: query.status });
        }
        if(query.source){
            qb.andWhere('req.source = :source', { source: query.source });
        }
        if(query.priority){
            qb.andWhere('req.priority = :priority', { priority: query.priority });
        }
        if(query.vendorid){
            qb.andWhere('req.vendorid = :vendorid', { vendorid: query.vendorid });
        }
        if(ownerId){
            qb.andWhere('req.createdby = :ownerId', { ownerId });
        }
        const rows = await qb.orderBy('req.createdon', 'DESC').getMany();
        return ownerId ? this.forRequester(rows) : rows;
    }    

    async findAllRequestsByCriteria(criteria: { status?: string; source?: string; priority?: string; vendorid?: number | string }, ownerId?: number) {
        let whereclause = 'req.isActive = :flag'
        if(ownerId){
            whereclause += ' and req.createdby = :ownerId'
        }
        if(criteria.status){
            whereclause += ' and req.status = :status'
        }
        if(criteria.source){
            whereclause += ' and req.source = :source'
        }
        if(criteria.priority){
            whereclause += ' and req.priority = :priority'
        }
        if(criteria.vendorid){
            whereclause += ' and req.vendorid = :vendorid'
        }
        const rows = await this.requestRepository.createQueryBuilder('req')
        .leftJoinAndSelect("req.product", "product")
        .leftJoinAndSelect("req.vendor", "vendor")
        .leftJoinAndSelect("req.po", "po")
        .select(['req','product','vendor.id','vendor.name','po.id','po.status'])
        .where(whereclause, {...criteria, flag: true, ownerId })
        .orderBy('req.createdon', 'DESC')
        .getMany();
        return ownerId ? this.forRequester(rows) : rows;
    }

    async findAllOrdersByCriteria(criteria: { status?: string; approvalstatus?: string; vendorid?: number | string }) {
        let whereclause = 'or.isActive = :flag'
        if(criteria.status){
            whereclause += ' and or.status = :status'
        }
        if(criteria.approvalstatus){
            whereclause += ' and or.approvalstatus = :approvalstatus'
        }
        if(criteria.vendorid){
            whereclause += ' and or.vendorid = :vendorid'
        }
        const orders = await this.orderRepository.createQueryBuilder('or')
        .innerJoinAndSelect("or.vendor", "vendor")
        .select(['or','vendor.name'])
              .where(whereclause, {...criteria, flag: true }).orderBy('or.createdon', 'DESC').getMany();
        return this.attachOrderSummaries(orders);
    }

    async findAllOrders(query: { status?: string; approvalstatus?: string; vendorid?: number | string }) {
        const qb = this.orderRepository.createQueryBuilder('or')
        .innerJoinAndSelect("or.vendor", "vendor")
        .select(['or','vendor.name'])
              .where('or.isActive = :flag', { flag: true });
        if(query.status){
            qb.andWhere('or.status = :status', { status: query.status });
        }
        if(query.approvalstatus){
            qb.andWhere('or.approvalstatus = :approvalstatus', { approvalstatus: query.approvalstatus });
        }
        if(query.vendorid){
            qb.andWhere('or.vendorid = :vendorid', { vendorid: query.vendorid });
        }
        const orders = await qb.orderBy('or.createdon', 'DESC').getMany();
        return this.attachOrderSummaries(orders);
    }

    /** Adds `linecount` (active requests) + `estimatedtotal` (qty x latest unit cost) to a list of orders, in one batch query. */
    private async attachOrderSummaries(orders: any[]) {
        if(orders.length === 0){
            return orders;
        }
        const ids = orders.map((o:any) => o.id);
        const rows = await this.manager.query(`
            select
                pr.order_id as order_id,
                count(*)::int as line_count,
                coalesce(sum(coalesce(pr.ordered_qty, pr.qty, 0) * coalesce(latest.ptr_cost, 0)), 0) as estimated_total,
                coalesce(sum(coalesce(pr.ordered_qty, pr.qty, 0)), 0) as ordered_qty,
                coalesce(sum(rcv.qty), 0) as received_qty
            from purchase_request pr
            left join lateral (
                select coalesce(sum(pii.qty), 0) as qty
                from purchase_invoice_item pii
                inner join purchase_invoice pi2 on pi2.id = pii.invoice_id
                where pii.request_id = pr.id
                  and pii.active = true and pii.archive = false
                  and pi2.active = true and pi2.archive = false and pi2.status = 'COMPLETE'
            ) rcv on true
            left join lateral (
                select pii.ptr_cost
                from purchase_invoice_item pii
                inner join purchase_invoice pi on pi.id = pii.invoice_id
                where pii.product_id = pr.product_id
                  and pii.active = true and pii.archive = false
                  and pi.active = true and pi.archive = false
                order by pi.invoice_date desc, pi.id desc, pii.id desc
                limit 1
            ) latest on true
            where pr.order_id = any($1::int[])
              and pr.active = true and pr.archive = false
            group by pr.order_id
        `, [ids]);
        const summaries = new Map<number, any>(rows.map((r:any) => [+r.order_id, { linecount: +r.line_count, estimatedtotal: +(+r.estimated_total).toFixed(2), orderedqty: +r.ordered_qty, receivedqty: +r.received_qty }]));
        return orders.map((order:any) => ({
            ...order,
            ...(summaries.get(order.id) || { linecount: 0, estimatedtotal: 0, orderedqty: 0, receivedqty: 0 })
        }));
    }

    async createOrder(dto: CreatePurchaseOrderDto, userid: number) {
        if(!dto.vendorid){
            throw new BadRequestException('Vendor is required.');
        }
        const vendor = await this.vendorRepository.findOne({ where: { id: +dto.vendorid } });
        if(!vendor){
            throw new BadRequestException('Vendor not found.');
        }
        await assertVendorUsable(this.vendorRepository.manager, dto.vendorid, 'a new purchase order');
        const order = await this.orderRepository.save({
            ...dto,
            status: dto.status || 'PENDING',
            approvalstatus: dto.approvalstatus || 'Not Required',
            createdby:userid
        });
        return order;
    }
    
    /**
     * A request-only role (Sales Staff) states what is needed and why. Everything the buying side decides (vendor, status,
     * ordered and fulfilled quantities, internal notes) is ignored for them: a new request is always Open.
     */
    async createRequest(dto: CreatePurchaseRequestDto, userid: number, requestOnly = false) {
        if (requestOnly) {
            const d: any = dto;
            dto = {
                productid: d.productid, requestedname: d.requestedname, qty: d.qty, source: d.source, requesttype: d.requesttype, priority: d.priority,
                neededby: d.neededby, customername: d.customername, customerphone: d.customerphone,
                sourceref: d.sourceref, comments: d.comments,
            } as any;
        }
        await assertVendorUsable(this.vendorRepository.manager, dto.vendorid, 'a new purchase request');
        const normalize = (value:any) => {
            if(value === undefined || value === null){
                return undefined;
            }
            const text = `${value}`.trim();
            return text === '' ? undefined : text;
        };
        // a product from the list, or the name of one that is not in it yet (purchasing links it before it can be ordered)
        const requestedname = dto.productid ? undefined : normalize(dto.requestedname);
        if(!dto.productid && !requestedname){
            throw new BadRequestException('Choose the product, or type its name if it is not in the product list.');
        }
        if(!dto.productid && (dto.orderid || ['Ordered', 'Received'].includes(dto.status))){
            throw new BadRequestException(UNLISTED_NOT_ORDERABLE);
        }
        const request:any = {
            ...dto,
            requestedname,
            productid: dto.productid ? +dto.productid : undefined,
            vendorid: dto.vendorid ? +dto.vendorid : undefined,
            qty: dto.qty ? +dto.qty : 0,
            suggestedqty: dto.suggestedqty ? +dto.suggestedqty : undefined,
            orderedqty: dto.orderedqty ? +dto.orderedqty : undefined,
            fulfilledqty: dto.fulfilledqty ? +dto.fulfilledqty : undefined,
            neededby: normalize(dto.neededby),
            customername: normalize(dto.customername),
            customerphone: normalize(dto.customerphone),
            sourceref: normalize(dto.sourceref),
            comments: normalize(dto.comments),
            notes: normalize(dto.notes),
            status: dto.status || 'Open',
            source: dto.source || 'Staff',
            requesttype: dto.requesttype || 'Ad Hoc',
            priority: dto.priority || 'Normal',
            createdby:userid
        };
        return this.requestRepository.save(request);
    }
    
    async findOrderById(id:string){
        const order = await this.orderRepository.createQueryBuilder('or')
        .innerJoinAndSelect("or.vendor", "vendor")
        .leftJoinAndSelect("or.requests", "requests")
        .leftJoinAndSelect("requests.product", "product")
        .leftJoinAndSelect("requests.vendor", "requestvendor")
        .select(['or','requests', 'product','vendor','requestvendor.id','requestvendor.name'])
          .where('or.id = :id', { id })
          .getOne();
        return order ? this.enrichOrder(order) : order;
    }

    async findRequestById(id:number, ownerId?: number){
          const qb = this.requestRepository.createQueryBuilder('req')
          .leftJoinAndSelect("req.product", "product")
          .leftJoinAndSelect("req.vendor", "vendor")
          .leftJoinAndSelect("req.po", "po")
          .select(['req','product','vendor.id','vendor.name','po.id','po.status'])
          .where('req.id = :id', { id });
          if (ownerId) qb.andWhere('req.createdby = :ownerId', { ownerId });
          const row = await qb.getOne();
          return row && ownerId ? this.forRequester([row])[0] : row;
    }
    
    async updateRequest(id: number | string, values: Partial<PurchaseRequest>, userid: number) {
        const v: any = values;
        if(v.orderedqty !== undefined){
            const own = await this.requestRepository.findOne({ where: { id: +id } });
            if(own?.orderid){
                const [po] = await this.manager.query(`select status from purchase_order where id = $1`, [own.orderid]);
                if(po && !['PENDING', 'REJECTED'].includes(po.status)){
                    throw new BadRequestException('The quantity cannot be changed once the order has been submitted.');
                }
            }
            if(!(Number(v.orderedqty) > 0)) throw new BadRequestException('The quantity must be at least 1.');
        }
        if(v.orderid || ['Ordered', 'Received'].includes(v.status)){
            // a request for a product that is not in the list cannot be ordered until it is linked to one
            const row = await this.requestRepository.findOne({ where: { id: +id } });
            if(row && !row.productid && !v.productid){
                throw new BadRequestException(UNLISTED_NOT_ORDERABLE);
            }
        }
        if(v.requestedname !== undefined){
            v.requestedname = `${v.requestedname || ''}`.trim() || null;
        }
        return this.requestRepository.update(id, {...values, updatedby:userid});
    }
    /**
     * Takes an item off its order: the request goes back to Reviewed and is free again. The order link has to be set to null:
     * TypeORM skips undefined values in an update, so the item used to stay on the order it was taken off.
     * Only while the order can still be changed (a draft, or one that was turned down).
     */
    async removeOrder(id: number | string, userid: number) {
        const [row] = await this.manager.query(
            `select pr.order_id, po.status from purchase_request pr left join purchase_order po on po.id = pr.order_id where pr.id = $1`, [+id]);
        if(row?.order_id && !['PENDING', 'REJECTED'].includes(row.status)){
            throw new BadRequestException('An item cannot be taken off an order that has been submitted.');
        }
        return this.requestRepository.update(id, {status: 'Reviewed', orderid: null as any, orderedqty: null as any, updatedby:userid});
    }

    /**
     * Deletes a draft order and frees what was on it. A request somebody raised goes back to Open (as it was before it was put on the
     * order) so it can be reviewed and ordered again; a line the Reorder screen made up only for this order is removed with it (it would otherwise be counted twice).
     */
    async deleteOrder(id: number | string, userid: number) {
        return this.manager.transaction(async (tx) => {
            await tx.query(
                `update purchase_request set active = false, updated_by = $2
                  where order_id = $1 and source = 'System' and source_ref = 'purchase-suggestions'`, [+id, userid]);
            await tx.query(
                `update purchase_request set status = 'Open', order_id = null, ordered_qty = null, updated_by = $2
                  where order_id = $1 and active = true and status = 'Ordered'`, [+id, userid]);
            return tx.getRepository(PurchaseOrder).update(id, {isActive: false, updatedby: userid});
        });
    }

    /**
     * Cancels (voids) an order that was sent or is waiting for approval, as long as no purchase invoice is linked to it. The order stays on record as
     * CANCELLED with who and why; what was on it is freed as when a draft is deleted: a request goes back to Open, a line the Reorder screen made up is removed.
     */
    async cancelOrder(id: number | string, reason: string, userid: number) {
        const why = `${reason ?? ''}`.trim();
        if(why.length < 3) throw new BadRequestException('Say why the order is being cancelled.');
        return this.manager.transaction(async (tx) => {
            const [po] = await tx.query(`select id, status, active, po_number from purchase_order where id = $1 for update`, [+id]);
            if(!po || !po.active) throw new BadRequestException('Order not found.');
            if(po.status === 'CANCELLED') throw new BadRequestException('This order is already cancelled.');
            if(po.status === 'PENDING') throw new BadRequestException('A draft is deleted, not cancelled.');
            const [{ n: invoices }] = await tx.query(
                `select count(*)::int as n from purchase_invoice where purchase_order_id = $1::text and active = true and archive = false`, [+id]);
            if(invoices > 0) throw new BadRequestException(`A purchase invoice is linked to this order (${invoices}), so it cannot be cancelled. Remove or unlink the invoice first.`);
            await tx.query(
                `update purchase_request set active = false, updated_by = $2
                  where order_id = $1 and source = 'System' and source_ref = 'purchase-suggestions'`, [+id, userid]);
            await tx.query(
                `update purchase_request set status = 'Open', order_id = null, ordered_qty = null, updated_by = $2
                  where order_id = $1 and active = true and status = 'Ordered'`, [+id, userid]);
            await tx.query(
                `update purchase_order set status = 'CANCELLED', cancelled_on = now(), cancelled_by = $2, cancel_reason = $3, updated_by = $2, updated_on = now() where id = $1`,
                [+id, userid, why]);
            return { id: +id, status: 'CANCELLED', ponumber: po.po_number };
        });
    }

    async updateOrder(id: number | string, values: Partial<PurchaseOrder>, userid: number) {
        return this.orderRepository.update(id, {...values, updatedby:userid});
    }

    async submitOrder(id:number, userid:number, roleid?:number){
        const order = await this.findOrderById(`${id}`);
        if(!order){
            return null;
        }

        const activeRequests = (order.requests || []).filter((r:any) => r?.isActive !== false && +(r?.qty || 0) > 0);
        if(activeRequests.length === 0){
            throw new BadRequestException('Cannot submit a purchase order with no line items.');
        }

        const summary = await this.evaluateOrderApproval(order);
        // approval_mode 'self': a maker who may approve purchase orders approves their own, on the record
        const selfApproved = summary.approvalrequired && !!roleid && await this.canApproveOrder(roleid)
            && await approvalModeFor(this.manager, { userId: userid }) === 'self';
        const nextState = summary.approvalrequired && !selfApproved ? {
            status: 'PENDING_APPROVAL',
            approvalstatus: 'Pending',
            approvalreason: summary.approvalreasons.join(' | '),
            approvalrequestedby: userid,
            approvalrequestedat: new Date(),
            approvedby: null,
            approvedat: null,
            rejectedby: null,
            rejectedat: null,
            rejectionreason: null,
        } : {
            status: 'SUBMITTED',
            approvalstatus: 'Approved',
            approvalreason: selfApproved ? `Self-approved by the maker: ${summary.approvalreasons.join(' | ')}` : null,
            approvalrequestedby: userid,
            approvalrequestedat: new Date(),
            approvedby: userid,
            approvedat: new Date(),
            rejectedby: null,
            rejectedat: null,
            rejectionreason: null,
        };

        await this.orderRepository.update(id, { ...nextState, updatedby: userid });
        return this.findOrderById(`${id}`);
    }

    async approveOrder(id:number, userid:number){
        await this.assertNotCancelled(id);
        await this.orderRepository.update(id, {
            status: 'SUBMITTED',
            approvalstatus: 'Approved',
            approvedby: userid,
            approvedat: new Date(),
            rejectedby: null,
            rejectedat: null,
            rejectionreason: null,
            updatedby: userid
        });
        return this.findOrderById(`${id}`);
    }

    private async assertNotCancelled(id:number){
        const [po] = await this.manager.query(`select status from purchase_order where id = $1`, [+id]);
        if(po?.status === 'CANCELLED') throw new BadRequestException('This order was cancelled.');
    }

    async rejectOrder(id:number, reason:string, userid:number){
        await this.assertNotCancelled(id);
        await this.orderRepository.update(id, {
            status: 'REJECTED',
            approvalstatus: 'Rejected',
            rejectedby: userid,
            rejectedat: new Date(),
            rejectionreason: reason || 'Approval rejected',
            updatedby: userid
        });
        return this.findOrderById(`${id}`);
    }

    async canApproveOrder(roleid:number){
        const role = await this.roleRepository.findOne({ where: { id: roleid, isActive: true, isArchived: false }});
        const permissions:any[] = Array.isArray(role?.permissions) ? role.permissions : [];
        return permissions.some((resource:any) => {
            const resourceName = `${resource?.resource || ''}`.toLowerCase();
            const policies = Array.isArray(resource?.policies) ? resource.policies : [];
            return resourceName === 'purchaseorders' && policies.some((policy:any) => `${policy?.action || ''}`.toLowerCase() === 'approve');
        });
    }

    /**
     * What to buy, from what sold and what is on the shelf.
     *   demand   units sold per day over the last `days` (when nothing sold, over the longer `slowdays`, so slow movers are not lost)
     *   season   last year and the year before: how that same stretch of the year went compared with the days leading up to it
     *            (sales in the next `targetdays` against sales in the `days` before today, a year earlier); the ratio, held between 0.5 and 2.5,
     *            scales the demand. A product that sold nothing lately but sold in this stretch last year is brought back by last year's figure.
     *   need     demand over `targetdays`, plus the product's minimum stock, less what is on hand; then the open requests on top
     * With a store the sales, the stock and the minimum are that store's; without one they are all stores together.
     */
    async findSuggestions(query:any){
        const days = Math.max(1, Math.round(+(query.days || 30)));
        const targetDays = Math.max(1, Math.round(+(query.targetdays || 21)));
        const slowDays = Math.max(days, Math.round(+(query.slowdays || 90)));
        const seasonal = `${query.seasonal ?? 'true'}` !== 'false';
        const vendorFilter = query.vendorid ? +query.vendorid : null;
        const storeFilter = query.storeid ? +query.storeid : null;

        const rows = await this.manager.query(`
            with recent_sales as (
                select
                    si.product_id,
                    sum(si.qty) filter (where s.bill_date >= current_date - make_interval(days => $1::int)) as sales_qty,
                    sum(si.qty) as long_qty
                from sale_item si
                inner join sale s on s.id = si.sale_id
                where s.status = 'COMPLETE'
                  and s.active = true
                  and s.archive = false
                  and si.active = true
                  and si.archive = false
                  and s.bill_date >= current_date - make_interval(days => $5::int)
                  and ($4::int is null or s.store_id = $4::int)
                group by si.product_id
            ),
            season as (
                select
                    si.product_id,
                    sum(si.qty) filter (where s.bill_date >= current_date - interval '1 year' - make_interval(days => $1::int)
                                          and s.bill_date < current_date - interval '1 year') as ly1_recent,
                    sum(si.qty) filter (where s.bill_date >= current_date - interval '1 year'
                                          and s.bill_date < current_date - interval '1 year' + make_interval(days => $2::int)) as ly1_next,
                    sum(si.qty) filter (where s.bill_date >= current_date - interval '2 years' - make_interval(days => $1::int)
                                          and s.bill_date < current_date - interval '2 years') as ly2_recent,
                    sum(si.qty) filter (where s.bill_date >= current_date - interval '2 years'
                                          and s.bill_date < current_date - interval '2 years' + make_interval(days => $2::int)) as ly2_next
                from sale_item si
                inner join sale s on s.id = si.sale_id
                where $6::boolean
                  and s.status = 'COMPLETE'
                  and s.active = true
                  and s.archive = false
                  and si.active = true
                  and si.archive = false
                  and s.bill_date >= current_date - interval '2 years' - make_interval(days => $1::int)
                  and s.bill_date < current_date - interval '1 year' + make_interval(days => $2::int)
                  and ($4::int is null or s.store_id = $4::int)
                group by si.product_id
            ),
            stock_by_product as (
                select
                    pii.product_id,
                    sum(
                        (case when $4::int is null or pi.store_id = $4::int
                              then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
                        - coalesce(sold.sold, 0)
                        + coalesce(adj.adjusted, 0)
                    ) as available_stock
                from purchase_invoice_item pii
                inner join product p on p.id = pii.product_id
                inner join purchase_invoice pi on pi.id = pii.invoice_id
                left join (
                    select si.purchase_item_id, sum(si.qty) as sold
                    from sale_item si
                    inner join sale s on s.id = si.sale_id
                    where si.active = true and si.archive = false
                      and ($4::int is null or s.store_id = $4::int)
                    group by si.purchase_item_id
                ) sold on sold.purchase_item_id = pii.id
                left join (
                    select item_id, sum(qty) as adjusted
                    from product_qtychange
                    where active = true and archive = false
                      and coalesce(status, 'APPROVED') = 'APPROVED'
                      and ($4::int is null or store_id = $4::int)
                    group by item_id
                ) adj on adj.item_id = pii.id
                where pii.active = true
                  and pii.archive = false
                  and pi.active = true
                  and pi.archive = false
                group by pii.product_id
            ),
            preferred_vendor as (
                select distinct on (pii.product_id)
                    pii.product_id,
                    pi.vendor_id,
                    v.business_name
                from purchase_invoice_item pii
                inner join purchase_invoice pi on pi.id = pii.invoice_id
                inner join vendor v on v.id = pi.vendor_id
                where pii.active = true
                  and pii.archive = false
                  and pi.active = true
                  and pi.archive = false
                order by pii.product_id, pi.invoice_date desc, pi.id desc
            ),
            open_manual_requests as (
                select
                    pr.product_id,
                    coalesce(pr.vendor_id, pv.vendor_id) as vendor_id,
                    sum(pr.qty - coalesce(pr.fulfilled_qty, 0))::int as adhoc_qty,
                    array_agg(pr.id order by pr.id) as request_ids,
                    string_agg(distinct pr.source, ', ') as sources,
                    max(case pr.priority
                        when 'Urgent' then 4
                        when 'High' then 3
                        when 'Normal' then 2
                        else 1 end) as priority_rank
                from purchase_request pr
                left join preferred_vendor pv on pv.product_id = pr.product_id
                where pr.active = true
                  and pr.archive = false
                  and pr.product_id is not null
                  and pr.status in ('Open', 'Reviewed')
                group by pr.product_id, coalesce(pr.vendor_id, pv.vendor_id)
            ),
            demand_products as (
                select product_id from recent_sales
                union
                select product_id from open_manual_requests
                union
                -- products already on an order that has not been received: listed too, so the screen can say so
                select pr.product_id from purchase_request pr
                  join purchase_order po on po.id = pr.order_id and po.active = true
                 where pr.active = true and pr.archive = false and pr.status = 'Ordered' and pr.product_id is not null
                   and po.status in ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED')
                union
                select product_id from season where coalesce(ly1_next, 0) + coalesce(ly2_next, 0) > 0
                union
                select id from product where coalesce(min_stock, 0) > 0
            ),
            calc as (
                select
                    p.id as product_id,
                    p.title,
                    p.pack,
                    coalesce(p.min_stock, 0) as min_stock,
                    coalesce(omr.vendor_id, pv.vendor_id) as vendor_id,
                    v.business_name as vendor_name,
                    coalesce(sb.available_stock, 0)::numeric as available_stock,
                    coalesce(rs.sales_qty, 0)::numeric as sales_qty,
                    coalesce(rs.long_qty, 0)::numeric as long_qty,
                    case when coalesce(rs.sales_qty, 0) > 0 then rs.sales_qty::numeric / $1::numeric
                         else coalesce(rs.long_qty, 0)::numeric / $5::numeric end as base_rate,
                    case when coalesce(se.ly1_recent, 0) + coalesce(se.ly2_recent, 0) >= 5 and coalesce(rs.sales_qty, 0) > 0
                         then least(greatest(
                                ((coalesce(se.ly1_next, 0) + coalesce(se.ly2_next, 0))::numeric / $2::numeric)
                                / ((coalesce(se.ly1_recent, 0) + coalesce(se.ly2_recent, 0))::numeric / $1::numeric), 0.5), 2.5)
                         else 1 end as season_factor,
                    (coalesce(se.ly1_next, 0) + coalesce(se.ly2_next, 0))::numeric
                        / nullif((case when coalesce(se.ly1_next, 0) > 0 then 1 else 0 end) + (case when coalesce(se.ly2_next, 0) > 0 then 1 else 0 end), 0) as ly_next_avg,
                    coalesce(omr.adhoc_qty, 0) as adhoc_qty,
                    coalesce(omr.request_ids, '{}'::int[]) as request_ids,
                    omr.sources,
                    coalesce(omr.priority_rank, 0) as priority_rank
                from demand_products dp
                inner join product p on p.id = dp.product_id
                left join recent_sales rs on rs.product_id = p.id
                left join season se on se.product_id = p.id
                left join stock_by_product sb on sb.product_id = p.id
                left join preferred_vendor pv on pv.product_id = p.id
                left join open_manual_requests omr on omr.product_id = p.id
                left join vendor v on v.id = coalesce(omr.vendor_id, pv.vendor_id)
                where p.active = true
                  and p.archive = false
                  and ($3::int is null or coalesce(omr.vendor_id, pv.vendor_id) = $3::int)
            ),
            forecast as (
                select c.*,
                    greatest(
                        ceil(c.base_rate * c.season_factor * $2::numeric),
                        case when c.base_rate = 0 then ceil(coalesce(c.ly_next_avg, 0)) else 0 end
                    )::int as forecast_qty
                from calc c
            )
            select
                f.product_id, f.title, f.pack, f.min_stock, f.vendor_id, f.vendor_name,
                f.available_stock, f.sales_qty, f.long_qty,
                round(f.base_rate, 2) as avg_daily_sales,
                case when f.base_rate > 0 then round(f.available_stock / f.base_rate, 1) else null end as stock_days_left,
                round(f.season_factor, 2) as season_factor,
                f.forecast_qty,
                greatest(f.forecast_qty + f.min_stock - ceil(f.available_stock), 0)::int as trend_qty,
                f.adhoc_qty,
                greatest(f.forecast_qty + f.min_stock - ceil(f.available_stock), 0)::int + f.adhoc_qty as final_qty,
                f.request_ids, f.sources, f.priority_rank,
                (f.base_rate = 0 and coalesce(f.ly_next_avg, 0) > 0) as from_last_year
            from forecast f
            order by f.priority_rank desc, final_qty desc, f.title
        `, [days, targetDays, vendorFilter, storeFilter, slowDays, seasonal]);

        // what is already on an order that has not been received: counted against the need, and shown on the row, so the same product is not ordered twice
        const onOrder = await this.manager.query(`
            select pr.product_id, sum(greatest(coalesce(pr.ordered_qty, pr.qty) - coalesce(pr.fulfilled_qty, 0), 0))::int as qty,
                   array_agg(distinct po.id order by po.id) as order_ids, bool_or(po.status = 'PENDING') as in_draft
              from purchase_request pr
              join purchase_order po on po.id = pr.order_id and po.active = true
             where pr.active = true and pr.archive = false and pr.status = 'Ordered' and pr.product_id is not null
               and po.status in ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED')
             group by pr.product_id`);
        const onOrderBy = new Map<number, any>(onOrder.map((o:any) => [+o.product_id, o]));

        return rows
            .map((row:any) => {
                const ord = onOrderBy.get(+row.product_id);
                if(ord){
                    row.on_order_qty = +ord.qty;
                    row.order_ids = ord.order_ids;
                    row.on_order_draft = !!ord.in_draft;
                    row.trend_qty = Math.max(0, +row.trend_qty - +ord.qty);
                    row.final_qty = +row.trend_qty + +row.adhoc_qty;
                } else {
                    row.on_order_qty = 0; row.order_ids = []; row.on_order_draft = false;
                }
                const reasons:string[] = [];
                const stock = +row.available_stock;
                if(+row.trend_qty > 0){
                    reasons.push('Low Stock');
                }
                if(+row.min_stock > 0 && stock < +row.min_stock){
                    reasons.push('Below Minimum');
                }
                if(+row.adhoc_qty > 0){
                    reasons.push('Customer Request');
                }
                if((row.priority_rank || 0) >= 4){
                    reasons.push('Urgent');
                }
                if(+row.sales_qty > 0 && (+row.stock_days_left || 0) <= 7){
                    reasons.push('Fast Moving');
                }
                if(+row.sales_qty === 0 && +row.long_qty > 0){
                    reasons.push('Slow Mover');
                }
                if(+row.season_factor >= 1.25){
                    reasons.push('Season Rising');
                } else if(+row.season_factor <= 0.8){
                    reasons.push('Season Easing');
                }
                if(row.from_last_year){
                    reasons.push('Sold Now Last Year');
                }

                return {
                    ...row,
                    available_stock: stock,
                    sales_qty: +row.sales_qty,
                    long_qty: +row.long_qty,
                    min_stock: +row.min_stock,
                    avg_daily_sales: +row.avg_daily_sales,
                    stock_days_left: row.stock_days_left === null ? null : +row.stock_days_left,
                    season_factor: +row.season_factor,
                    forecast_qty: +row.forecast_qty,
                    trend_qty: +row.trend_qty,
                    adhoc_qty: +row.adhoc_qty,
                    final_qty: +row.final_qty,
                    request_ids: Array.isArray(row.request_ids) ? row.request_ids : [],
                    reasons,
                    reason_summary: reasons.join(', ')
                };
            })
            .filter((row:any) => (query.includezero === 'true') || row.final_qty > 0 || row.on_order_qty > 0);
    }

    async createOrdersFromSuggestions(dto:any, userid:number){
        const items = (dto.items || []).filter((item:any) => +item.finalqty > 0 && item.vendorid);
        if(items.length === 0){
            return { created: 0, orders: [] };
        }

        return this.manager.transaction(async (transactionManager) => {
            const grouped = new Map<number, any[]>();
            for(const item of items){
                const key = +item.vendorid;
                const arr = grouped.get(key) || [];
                arr.push(item);
                grouped.set(key, arr);
            }

            const createdOrders:any[] = [];

            for(const [vendorid, vendorItems] of grouped.entries()){
                await assertVendorUsable(transactionManager, vendorid, 'a new purchase order');
                const vendor = await this.vendorRepository.findOne({ where: { id: vendorid, isActive: true, isArchived: false }});
                const sourceSummary = Array.from(new Set(vendorItems.map((item:any) => item.reasonsummary).filter(Boolean))).join(' | ');
                const orderRepo = transactionManager.getRepository(PurchaseOrder);
                // adddraft: put the items on the vendor's open draft (the latest) instead of starting another one
                let order:any = null;
                let reused = false;
                if(dto.adddraft){
                    order = await orderRepo.findOne({ where: { vendorid, status: 'PENDING', isActive: true }, order: { id: 'DESC' } });
                    if(order){
                        reused = true;
                        if(sourceSummary && !`${order.sourcesummary || ''}`.includes(sourceSummary)){
                            await orderRepo.update(order.id, { sourcesummary: [order.sourcesummary, sourceSummary].filter(Boolean).join(' | '), updatedby: userid });
                        }
                    }
                }
                if(!order){
                    order = await orderRepo.save(orderRepo.create({
                        vendorid,
                        status: 'PENDING',
                        comments: dto.comments || 'Generated from purchase suggestions',
                        expecteddate: dto.expecteddate || null,
                        sourcesummary: sourceSummary || 'Generated from purchase suggestions',
                        ponumber: undefined,
                        createdby: userid,
                        updatedby: userid
                    }));
                }

                const orderRequests:number[] = [];

                for(const item of vendorItems){
                    const requestIds = (item.requestids || []).map((id:any) => +id).filter((id:number) => id > 0);
                    let coveredByRequests = 0;

                    if(requestIds.length > 0){
                        const existingRequests = await transactionManager.getRepository(PurchaseRequest).findByIds(requestIds as any);
                        for(const request of existingRequests){
                            coveredByRequests += +(request.qty || 0);
                            await transactionManager.getRepository(PurchaseRequest).update(request.id, {
                                orderid: order.id,
                                status: 'Ordered',
                                vendorid,
                                orderedqty: request.qty,
                                updatedby: userid
                            });
                            orderRequests.push(request.id);
                        }
                    }

                    const remainder = Math.max(0, +item.finalqty - coveredByRequests);
                    if(remainder > 0){
                        const systemRequest = await transactionManager.getRepository(PurchaseRequest).save({
                            productid: +item.productid,
                            orderid: order.id,
                            vendorid,
                            status: 'Ordered',
                            requesttype: 'Refill',
                            source: 'System',
                            priority: 'Normal',
                            qty: remainder,
                            suggestedqty: +item.trendqty || remainder,
                            orderedqty: remainder,
                            sourceref: 'purchase-suggestions',
                            comments: item.reasonsummary || 'Generated from purchase suggestions',
                            notes: dto.comments || null,
                            createdby: userid,
                            updatedby: userid
                        });
                        orderRequests.push(systemRequest.id);
                    }
                }

                createdOrders.push({
                    id: order.id,
                    reused,
                    vendorid,
                    vendorname: vendor?.name || '',
                    requestids: orderRequests
                });
            }

            return {
                created: createdOrders.length,
                orders: createdOrders
            };
        });
    }

    /**
     * Folds draft orders of one vendor into one: the items of the others move to `targetid` and the others are removed.
     * Only drafts (PENDING), all of the same vendor; a submitted order is never touched.
     */
    async mergeDraftOrders(targetid:number, sourceids:number[], userid:number){
        const sources = Array.from(new Set((sourceids || []).map((i:any) => +i).filter((i:number) => i > 0 && i !== +targetid)));
        if(!(+targetid > 0) || sources.length === 0){
            throw new BadRequestException('Choose the order to keep and at least one other draft to fold into it.');
        }
        return this.manager.transaction(async (tx) => {
            const rows = await tx.query(
                `select id, vendor_id, status, active, source_summary, comments from purchase_order where id = any($1::int[]) for update`, [[+targetid, ...sources]]);
            const byId = new Map<number, any>(rows.map((r:any) => [+r.id, r]));
            const target = byId.get(+targetid);
            if(!target || !target.active) throw new BadRequestException('The order to keep was not found.');
            for(const id of [+targetid, ...sources]){
                const o = byId.get(id);
                if(!o || !o.active) throw new BadRequestException(`Order #${id} was not found.`);
                if(o.status !== 'PENDING') throw new BadRequestException(`Order #${id} is not a draft (${o.status}): only drafts can be merged.`);
                if(+o.vendor_id !== +target.vendor_id) throw new BadRequestException(`Order #${id} is for another vendor: only drafts of the same vendor can be merged.`);
            }
            const moved = await tx.query(
                `update purchase_request set order_id = $1, updated_by = $3 where order_id = any($2::int[]) and active = true returning id`, [+targetid, sources, userid]);
            const summaries = sources.map((id) => byId.get(id)?.source_summary).filter(Boolean);
            const merged = Array.from(new Set([target.source_summary, ...summaries].filter(Boolean))).join(' | ');
            await tx.query(`update purchase_order set source_summary = $2, updated_by = $3 where id = $1`, [+targetid, merged || null, userid]);
            await tx.query(`update purchase_order set active = false, comments = coalesce(comments || ' ', '') || '(merged into #' || $2::text || ')', updated_by = $3 where id = any($1::int[])`, [sources, +targetid, userid]);
            return { id: +targetid, merged: sources, moved: moved.length };
        });
    }

    private async enrichOrder(order:any){
        const summary = await this.evaluateOrderApproval(order);
        const fulfilment = await this.getFulfilmentByRequest((order.requests || []).map((r:any) => r.id));
        const costs = await this.getLatestUnitCosts(Array.from(new Set<number>((order.requests || []).map((r:any) => +(r.product?.id || r.productid || 0)).filter((i:number) => i > 0))));
        const peopleIds = [order.createdby, order.approvalrequestedby, order.approvedby, order.rejectedby].filter((i:any) => !!i);
        const people = new Map<number, string>();
        if(peopleIds.length){
            const rows = await this.manager.query(`select id, full_name as fullname from app_user where id = any($1::int[])`, [peopleIds]);
            rows.forEach((r:any) => people.set(+r.id, r.fullname));
        }
        return {
            ...order,
            estimatedtotal: summary.estimatedtotal,
            approvalrequired: summary.approvalrequired,
            approvalreasons: summary.approvalreasons,
            createdbyname: people.get(+order.createdby) || null,
            approvedbyname: people.get(+order.approvedby) || null,
            rejectedbyname: people.get(+order.rejectedby) || null,
            requests: (order.requests || []).map((request:any) => {
                const unitcost = costs.get(+(request.product?.id || request.productid || 0)) || 0;
                return {
                    ...request,
                    unitcost,
                    linevalue: +(unitcost * +(request.orderedqty ?? request.qty ?? 0)).toFixed(2),
                    ...(fulfilment.get(request.id) || { invoicedqty: 0, receivedqty: 0 })
                };
            })
        };
    }

    /** Per-request qty invoiced (on any invoice) vs received (invoice status COMPLETE = stock raised). */
    private async getFulfilmentByRequest(requestIds:number[]){
        const result = new Map<number, { invoicedqty:number; receivedqty:number }>();
        if(requestIds.length === 0){
            return result;
        }
        const rows = await this.manager.query(`
            select
                pii.request_id,
                sum(pii.qty)::numeric as invoiced_qty,
                sum(pii.qty) filter (where pi.status = 'COMPLETE')::numeric as received_qty
            from purchase_invoice_item pii
            inner join purchase_invoice pi on pi.id = pii.invoice_id
            where pii.request_id = any($1::int[])
              and pii.active = true and pii.archive = false
              and pi.active = true and pi.archive = false
            group by pii.request_id
        `, [requestIds]);
        for(const row of rows){
            result.set(+row.request_id, {
                invoicedqty: +(row.invoiced_qty || 0),
                receivedqty: +(row.received_qty || 0)
            });
        }
        return result;
    }

    private async evaluateOrderApproval(order:any){
        const requests = order?.requests || [];
        const productIds:number[] = Array.from(new Set<number>(
            requests
                .map((req:any) => +(req.product?.id || req.productid || 0))
                .filter((id:number) => id > 0)
        ));
        const unitCosts = await this.getLatestUnitCosts(productIds);
        const valueThreshold = await this.getPurchaseOrderApprovalValueThreshold();
        const reasons:string[] = [];
        let estimatedtotal = 0;

        for(const request of requests){
            const product = request.product;
            const qty = +(request.orderedqty || request.qty || 0);
            const unitCost = unitCosts.get(+(product?.id || request.productid || 0)) || 0;
            estimatedtotal += qty * unitCost;

            const props:any = product?.props || {};
            const requiresApproval = this.isTruthy(props.purchaseApprovalRequired);
            const qtyThreshold = this.toNumber(props.purchaseApprovalQtyThreshold);

            if(qtyThreshold !== null && qty >= qtyThreshold){
                reasons.push(`${product?.title || 'Product'} qty ${qty} exceeds approval threshold ${qtyThreshold}`);
            } else if(requiresApproval){
                reasons.push(`${product?.title || 'Product'} requires approval`);
            }
        }

        if(estimatedtotal > valueThreshold){
            reasons.push(`Estimated PO value ${estimatedtotal.toFixed(2)} exceeds threshold ${valueThreshold.toFixed(2)}`);
        }

        return {
            estimatedtotal: +estimatedtotal.toFixed(2),
            approvalrequired: reasons.length > 0,
            approvalreasons: Array.from(new Set(reasons))
        };
    }

    private async getLatestUnitCosts(productIds:number[]){
        const costs = new Map<number, number>();
        if(productIds.length === 0){
            return costs;
        }

        const rows = await this.manager.query(`
            select distinct on (pii.product_id)
                pii.product_id,
                coalesce(pii.ptr_cost, 0) as ptr_cost
            from purchase_invoice_item pii
            inner join purchase_invoice pi on pi.id = pii.invoice_id
            where pii.active = true
              and pii.archive = false
              and pi.active = true
              and pi.archive = false
              and pii.product_id = any($1::int[])
            order by pii.product_id, pi.invoice_date desc, pi.id desc, pii.id desc
        `, [productIds]);

        for(const row of rows){
            costs.set(+row.product_id, +row.ptr_cost || 0);
        }
        return costs;
    }

    private async getPurchaseOrderApprovalValueThreshold(){
        const setting = await this.settingRepository.findOne({
            where: {
                key: 'purchase_order_approval_value_threshold',
                isActive: true,
                isArchived: false
            }
        });
        return this.toNumber(setting?.value) || 5000;
    }

    private toNumber(value:any){
        if(value === undefined || value === null || value === ''){
            return null;
        }
        const parsed = +value;
        return Number.isFinite(parsed) ? parsed : null;
    }

    private isTruthy(value:any){
        return value === true || value === 'true' || value === 1 || value === '1';
    }
}

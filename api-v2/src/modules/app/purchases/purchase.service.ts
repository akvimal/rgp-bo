import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreatePurchaseOrderDto } from "./dto/create-order.dto";
import { CreatePurchaseRequestDto } from "./dto/create-request.dto";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { AppRole } from "src/entities/approle.entity";
import { Setting } from "src/entities/setting.entity";
import { Vendor } from "src/entities/vendor.entity";

@Injectable()
export class PurchaseService {

    constructor(@InjectRepository(PurchaseRequest) private readonly requestRepository: Repository<PurchaseRequest>,
            @InjectRepository(PurchaseOrder) private readonly orderRepository: Repository<PurchaseOrder>,
            @InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>,
            @InjectRepository(Setting) private readonly settingRepository: Repository<Setting>,
            @InjectRepository(Vendor) private readonly vendorRepository: Repository<Vendor>,
            @InjectEntityManager() private manager: EntityManager) { }

    async findAllRequests(query: { status?: string; source?: string; priority?: string; vendorid?: number | string }) {
        const qb = this.requestRepository.createQueryBuilder('req')
        .innerJoinAndSelect("req.product", "product")
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
        return qb.orderBy('req.createdon', 'DESC').getMany();
    }    

    async findAllRequestsByCriteria(criteria: { status?: string; source?: string; priority?: string; vendorid?: number | string }) {
        let whereclause = 'req.isActive = :flag'
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
        return this.requestRepository.createQueryBuilder('req')
        .innerJoinAndSelect("req.product", "product")
        .leftJoinAndSelect("req.vendor", "vendor")
        .leftJoinAndSelect("req.po", "po")
        .select(['req','product','vendor.id','vendor.name','po.id','po.status'])
        .where(whereclause, {...criteria, flag: true })
        .orderBy('req.createdon', 'DESC')
        .getMany();
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
        return this.orderRepository.createQueryBuilder('or')
        .innerJoinAndSelect("or.vendor", "vendor")
        .select(['or','vendor.name'])
              .where(whereclause, {...criteria, flag: true }).orderBy('or.createdon', 'DESC').getMany();
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
            return qb.orderBy('or.createdon', 'DESC').getMany();
    }

    async createOrder(dto: CreatePurchaseOrderDto, userid: number) {
        const order = await this.orderRepository.save({
            ...dto,
            status: dto.status || 'PENDING',
            approvalstatus: dto.approvalstatus || 'Not Required',
            createdby:userid
        });
        return order;
    }
    
    async createRequest(dto: CreatePurchaseRequestDto, userid: number) {
        const normalize = (value:any) => {
            if(value === undefined || value === null){
                return undefined;
            }
            const text = `${value}`.trim();
            return text === '' ? undefined : text;
        };
        const request:any = {
            ...dto,
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

    async findRequestById(id:number){
          return this.requestRepository.createQueryBuilder('req')
          .innerJoinAndSelect("req.product", "product")
          .leftJoinAndSelect("req.vendor", "vendor")
          .leftJoinAndSelect("req.po", "po")
          .select(['req','product','vendor.id','vendor.name','po.id','po.status'])
          .where('req.id = :id', { id })
          .getOne();
    }
    
    async updateRequest(id: number | string, values: Partial<PurchaseRequest>, userid: number) {
        return this.requestRepository.update(id, {...values, updatedby:userid});
    }
    async removeOrder(id: number | string, userid: number) {
        return this.requestRepository.update(id, {status: 'Reviewed', orderid: undefined, updatedby:userid});
    }

    async updateOrder(id: number | string, values: Partial<PurchaseOrder>, userid: number) {
        return this.orderRepository.update(id, {...values, updatedby:userid});
    }

    async submitOrder(id:number, userid:number){
        const order = await this.findOrderById(`${id}`);
        if(!order){
            return null;
        }

        const summary = await this.evaluateOrderApproval(order);
        const nextState = summary.approvalrequired ? {
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
            approvalreason: null,
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

    async rejectOrder(id:number, reason:string, userid:number){
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

    async findSuggestions(query:any){
        const days = Math.max(1, +(query.days || 30));
        const targetDays = Math.max(1, +(query.targetdays || 21));
        const vendorFilter = query.vendorid ? +query.vendorid : null;

        const rows = await this.manager.query(`
            with recent_sales as (
                select
                    si.product_id,
                    sum(si.qty) as sales_qty
                from sale_item si
                inner join sale s on s.id = si.sale_id
                where s.status = 'COMPLETE'
                  and s.active = true
                  and s.archive = false
                  and si.active = true
                  and si.archive = false
                  and s.bill_date >= current_date - ($1::text || ' days')::interval
                group by si.product_id
            ),
            stock_by_product as (
                select
                    pii.product_id,
                    sum(
                        ((pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1))
                        - coalesce(sold.sold, 0)
                        + coalesce(adj.adjusted, 0)
                    ) as available_stock
                from purchase_invoice_item pii
                inner join product p on p.id = pii.product_id
                inner join purchase_invoice pi on pi.id = pii.invoice_id
                left join (
                    select purchase_item_id, sum(qty) as sold
                    from sale_item
                    where active = true and archive = false
                    group by purchase_item_id
                ) sold on sold.purchase_item_id = pii.id
                left join (
                    select item_id, sum(qty) as adjusted
                    from product_qtychange
                    where active = true and archive = false
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
                  and pr.status in ('Open', 'Reviewed')
                group by pr.product_id, coalesce(pr.vendor_id, pv.vendor_id)
            ),
            demand_products as (
                select distinct product_id from recent_sales
                union
                select distinct product_id from open_manual_requests
            )
            select
                p.id as product_id,
                p.title,
                p.pack,
                coalesce(omr.vendor_id, pv.vendor_id) as vendor_id,
                v.business_name as vendor_name,
                coalesce(sb.available_stock, 0)::numeric as available_stock,
                coalesce(rs.sales_qty, 0)::numeric as sales_qty,
                round(coalesce(rs.sales_qty, 0)::numeric / $1::numeric, 2) as avg_daily_sales,
                case
                    when coalesce(rs.sales_qty, 0) > 0 then round(coalesce(sb.available_stock, 0)::numeric / (coalesce(rs.sales_qty, 0)::numeric / $1::numeric), 1)
                    else null
                end as stock_days_left,
                greatest(ceil(($2::numeric * (coalesce(rs.sales_qty, 0)::numeric / $1::numeric)) - coalesce(sb.available_stock, 0)::numeric), 0)::int as trend_qty,
                coalesce(omr.adhoc_qty, 0) as adhoc_qty,
                greatest(ceil(($2::numeric * (coalesce(rs.sales_qty, 0)::numeric / $1::numeric)) - coalesce(sb.available_stock, 0)::numeric), 0)::int
                    + coalesce(omr.adhoc_qty, 0) as final_qty,
                coalesce(omr.request_ids, '{}'::int[]) as request_ids,
                omr.sources,
                coalesce(omr.priority_rank, 0) as priority_rank
            from demand_products dp
            inner join product p on p.id = dp.product_id
            left join recent_sales rs on rs.product_id = p.id
            left join stock_by_product sb on sb.product_id = p.id
            left join preferred_vendor pv on pv.product_id = p.id
            left join open_manual_requests omr on omr.product_id = p.id
            left join vendor v on v.id = coalesce(omr.vendor_id, pv.vendor_id)
            where p.active = true
              and p.archive = false
              and ($3::int is null or coalesce(omr.vendor_id, pv.vendor_id) = $3::int)
            order by coalesce(omr.priority_rank, 0) desc, final_qty desc, p.title
        `, [days, targetDays, vendorFilter]);

        return rows
            .map((row:any) => {
                const reasons:string[] = [];
                if(+row.trend_qty > 0){
                    reasons.push('Low Stock');
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

                return {
                    ...row,
                    available_stock: +row.available_stock,
                    sales_qty: +row.sales_qty,
                    avg_daily_sales: +row.avg_daily_sales,
                    stock_days_left: row.stock_days_left === null ? null : +row.stock_days_left,
                    trend_qty: +row.trend_qty,
                    adhoc_qty: +row.adhoc_qty,
                    final_qty: +row.final_qty,
                    request_ids: Array.isArray(row.request_ids) ? row.request_ids : [],
                    reasons,
                    reason_summary: reasons.join(', ')
                };
            })
            .filter((row:any) => (query.includezero === 'true') || row.final_qty > 0);
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
                const vendor = await this.vendorRepository.findOne({ where: { id: vendorid, isActive: true, isArchived: false }});
                const sourceSummary = Array.from(new Set(vendorItems.map((item:any) => item.reasonsummary).filter(Boolean))).join(' | ');
                const orderRepo = transactionManager.getRepository(PurchaseOrder);
                const order = await orderRepo.save(orderRepo.create({
                    vendorid,
                    status: 'PENDING',
                    comments: dto.comments || 'Generated from purchase suggestions',
                    expecteddate: dto.expecteddate || null,
                    sourcesummary: sourceSummary || 'Generated from purchase suggestions',
                    ponumber: undefined,
                    createdby: userid,
                    updatedby: userid
                }));

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

    private async enrichOrder(order:any){
        const summary = await this.evaluateOrderApproval(order);
        return {
            ...order,
            estimatedtotal: summary.estimatedtotal,
            approvalrequired: summary.approvalrequired,
            approvalreasons: summary.approvalreasons
        };
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

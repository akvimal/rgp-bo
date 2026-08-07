import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { CreateSaleReturnItemDto } from "./dto/create-salereturnitem.dto";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturnitem.dto";
import { SaleItem } from "src/entities/sale-item.entity";
import { SaleReturnItem } from "src/entities/salereturn-item.entity";
import { Sale } from "src/entities/sale.entity";
import { SaleDelivery } from "src/entities/sale-delivery.entity";
import { StoreCashAccount } from "src/entities/store-cash-account.entity";

export interface SaleListQuery {
  date?: string;
  billno?: string;
  customer?: string;
  status?: string;
  actinguserid?: string;
  storeid?: string;
  page?: string;
  limit?: string;
}

export interface SaleItemsQuery {
  product?: string;
  category?: string;
  fromdate?: string;
  todate?: string;
  props?: Array<{ id: string; value: string }>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface SalePayload {
  billdate?: string;
  orderdate?: Date | string;
  orderno?: number;
  billno?: number;
  status?: string;
  ordertype?: string;
  deliverytype?: string;
  digimethod?: string | null;
  digirefno?: string | null;
  digiamt?: number;
  cashamt?: number;
  expreturndays?: number;
  docpending?: boolean;
  customerid?: number;
  customer?: any;
  actinguserid?: number | null;
  shiftid?: number | null;
  items?: any[];
}

@Injectable()
export class SaleService {

    constructor(@InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem) private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(SaleReturnItem) private readonly saleReturnItemRepository: Repository<SaleReturnItem>,
    @InjectEntityManager() private manager: EntityManager) { }

    async create(sale: SalePayload, userid: number, actingUserid?: number) {
        // Wrap entire sale creation in transaction to prevent orphaned data
        return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                // Step 1: Generate order and bill numbers (uses database sequences/locking)
                const nos = await transactionManager.query(`select generate_order_number() as order_no, generate_bill_number() as bill_no`);

                sale['orderno'] = nos[0]['order_no'];
                sale['orderdate'] = new Date();
                sale['billno'] = nos[0]['bill_no'];

                const storeRows = await transactionManager.query(`select id from stores order by id asc limit 1`);
                const storeid = storeRows?.[0]?.id || null;
                let shiftid = null;
                if (storeid) {
                    const shiftRows = await transactionManager.query(
                        `select id from store_shifts where store_id = $1 and status = 'OPEN' and (assigned_user_id = $2 or assigned_user_id is null) order by shift_date desc, id desc limit 1`,
                        [storeid, userid],
                    );
                    shiftid = shiftRows?.[0]?.id || null;
                }
                sale['shiftid'] = shiftid;

                // Step 2: Save sale header
                const savedSale = await transactionManager.save(Sale, {...sale, createdby:userid, actinguserid: actingUserid || userid});

                if (!savedSale || !savedSale.id) {
                    throw new Error('Failed to create sale header');
                }

                // Step 3: Save sale items with foreign key to sale
                if (sale.items && sale.items.length > 0) {
                    sale.items.forEach(i => {
                        i.saleid = savedSale.id;
                    });
                    await transactionManager.save(SaleItem, sale.items);
                }

                if (shiftid && Number(savedSale['cashamt'] || sale['cashamt'] || 0) > 0) {
                    await transactionManager.save(StoreCashAccount, {
                        transdate: new Date().toISOString().slice(0, 10),
                        category: 'SALE',
                        description: `Sale ${savedSale['billno'] || savedSale['id']}`,
                        deposit: Number(savedSale['cashamt'] || sale['cashamt'] || 0),
                        withdraw: 0,
                        store: { id: storeid },
                        shift: { id: shiftid },
                    } as any);
                }

                // The client only needs the saved header before loading the detail route.
                return savedSale;
            } catch (error) {
                // Transaction will automatically rollback on error
                throw new Error(`Failed to create sale: ${error.message}`);
            }
        });
    }

    /**
     * Create return items with transaction protection
     * Fixed: Batch insert now atomic, preventing orphaned return items
     */
    async createReturnItems(items: CreateSaleReturnItemDto[], userid: number) {
        return await this.saleReturnItemRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                items.forEach(item => {
                    item['createdby'] = userid;
                });
                return await transactionManager.save(SaleReturnItem, items);
            } catch (error) {
                // Transaction will automatically rollback on error
                throw new Error(`Failed to create return items: ${error.message}`);
            }
        });
    }

    /**
     * Update return item with transaction protection
     * Fixed: Update now atomic, ensuring consistency
     */
    async updateReturnItem(item: UpdateSaleReturnItemDto, userid: number) {
        return await this.saleReturnItemRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                item['updatedby'] = userid;
                return await transactionManager.save(SaleReturnItem, item);
            } catch (error) {
                // Transaction will automatically rollback on error
                throw new Error(`Failed to update return item: ${error.message}`);
            }
        });
    }


    async updateSale(sale: SalePayload & { id?: number }, userid: number, actingUserid?: number) {
        // Wrap entire sale update in transaction to maintain data consistency
        return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                // Step 1: Update sale header
                const updatedSale = await transactionManager.save(Sale, {...sale, updatedby:userid, actinguserid: actingUserid || sale.actinguserid || userid});

                if (!updatedSale || !updatedSale.id) {
                    throw new Error('Failed to update sale header');
                }

                // Step 2: Update sale items
                if (sale.items && sale.items.length > 0) {
                    sale.items.forEach(i => {
                        i.saleid = updatedSale.id;
                    });
                    await transactionManager.save(SaleItem, sale.items);
                }

                // The client only needs the saved header before loading the detail route.
                return updatedSale;
            } catch (error) {
                // Transaction will automatically rollback on error
                throw new Error(`Failed to update sale: ${error.message}`);
            }
        });
    }
    async removeItemsByIds(ids:any){
        return await this.saleItemRepository.delete(ids);
    } 

    async removeItems(saleid){
        return await this.saleItemRepository.delete({saleid});
    } 
  
    async createItem(createSaleItemDto: CreateSaleItemDto, userid:any) {
        return this.saleItemRepository.save({...createSaleItemDto, createdby:userid});
    }

    async findSaleItemsForSaleWithAvailableQty(id:number){
        const query = `select si.*, iv.* from sale_item si
        inner join inventory_view iv on iv.purchase_itemid = si.purchase_item_id
        inner join sale s on s.id = si.sale_id
        where s.id = $1`;
        return await this.manager.query(query, [id]);
    }

    async findSavedSales(){
        const query = `
        select s.id, bill_no, c."name", c.mobile, s.created_on 
        from sale s left join customer c on s.customer_id = c.id 
        where s.status = 'PENDING' order by created_on desc`;
        return await this.manager.query(query);
    }
    
    async findAll(query: SaleListQuery, userid: number | null, currentUserId?: number): Promise<PaginatedResult<Sale>> {
        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10)));

        // Determine which stores this user is allowed to see
        let allowedStoreIds: number[] | null = null;
        if (currentUserId) {
            const assignments: { store_id: number }[] = await this.manager.query(
                `SELECT store_id FROM user_stores WHERE user_id = $1`, [currentUserId]
            );
            if (assignments.length > 0) {
                allowedStoreIds = assignments.map(a => a.store_id);
            }
        }

        const qb = this.saleRepository.createQueryBuilder("sale")
        .leftJoinAndSelect("sale.delivery", "delivery")
        .leftJoinAndSelect("sale.customer", "customer")
        .leftJoinAndSelect("sale.created", "created")
        .leftJoinAndSelect("sale.actinguser", "actinguser")
        .leftJoin("sale.shift", "shift")
        .select(['sale', 'customer', 'customer.name', 'customer.mobile', 'created.id', 'created.fullname', 'actinguser.id', 'actinguser.fullname', 'delivery'])
        .where('sale.active = :flag', { flag: true });

        if (userid) {
            qb.andWhere('(sale.acting_user_id = :uid OR sale.created_by = :uid)', { uid: userid });
        }

        // Store filtering: restrict to allowed stores, optionally narrowed by query param
        if (allowedStoreIds !== null) {
            if (query.storeid) {
                const requested = Number(query.storeid);
                const effective = allowedStoreIds.includes(requested) ? [requested] : [];
                if (effective.length === 0) return { data: [], total: 0, page, limit };
                qb.andWhere('shift.storeid IN (:...storeids)', { storeids: effective });
            } else {
                qb.andWhere('shift.storeid IN (:...storeids)', { storeids: allowedStoreIds });
            }
        } else if (query.storeid) {
            // Business Head with a specific store selected
            qb.andWhere('shift.storeid = :storeid', { storeid: Number(query.storeid) });
        }

        if (query.date) {
            qb.andWhere(
                `sale.billdate >= CAST(:con AS date) AND sale.billdate < CAST(:con AS date) + INTERVAL '1 day'`,
                { con: query.date },
            );
        }
        if (query.billno) {
            qb.andWhere(`sale.bill_no = :billno`, { billno: query.billno });
        }
        if (query.customer) {
            qb.andWhere(`customer.id = :cid`, { cid: query.customer });
        }
        if (query.status) {
            qb.andWhere(`sale.status = :st`, { st: query.status });
        }

        qb.orderBy('sale.updatedon', 'DESC').skip((page - 1) * limit).take(limit);
        const [data, total] = await qb.getManyAndCount();
        return { data, total, page, limit };
    }

    async findAllItems(query: SaleItemsQuery, userid: number | null | undefined) {
       const qb = await this.saleItemRepository.createQueryBuilder("item")
                    .leftJoinAndSelect("item.sale", "sale")
                    .leftJoinAndSelect("sale.customer", "customer")
                    .leftJoinAndSelect("item.purchaseitem", "purchaseitem")
                    .leftJoinAndSelect("purchaseitem.product", "product")
                    .select(['item','sale','customer','purchaseitem','product'])
                    .where('sale.status = :st', { st:'COMPLETE' })
                    .andWhere('sale.active = true AND sale.archive = false')
                    .andWhere('item.active = true AND item.archive = false')
                    if(query.product){
                        qb.andWhere('product.title ilike :prod', { prod: query.product+'%' });
                    } 
        if(query.category){
            qb.andWhere('product.category = :ctg', { ctg:query.category });
        }
        if(query.fromdate && query.todate){
            qb.andWhere(
                `sale.billdate >= CAST(:from AS date) AND sale.billdate < CAST(:to AS date) + INTERVAL '1 day'`,
                { from:query.fromdate,to:query.todate },
            );
        }
        // if(userid){
        //     qb.andWhere('sale.createdby = :uid', { uid:userid });
        // }
        
        if(query.props){
            query.props.forEach((p, idx) => {
                const key = String(p.id).replace(/[^a-zA-Z0-9_]/g, '');
                if(key){
                    qb.andWhere(`product.more_props->>'${key}' = :propval${idx}`, { [`propval${idx}`]: p.value });
                }
            });
        }
        qb.orderBy('sale.billdate','DESC')
        return qb.getMany();
    }

    async getStaffSummary(query: any, currentUserId?: number) {
        let allowedStoreIds: number[] | null = null;
        if (currentUserId) {
            const assignments: { store_id: number }[] = await this.manager.query(
                `SELECT store_id FROM user_stores WHERE user_id = $1`, [currentUserId]
            );
            if (assignments.length > 0) {
                allowedStoreIds = assignments.map(a => a.store_id);
            }
        }

        const params: any[] = [];
        const conditions: string[] = [
            `s.status = 'COMPLETE'`, `s.active = true`
        ];

        if (query.fromdate) {
            params.push(query.fromdate);
            conditions.push(`s.bill_date >= CAST($${params.length} AS date)`);
        }
        if (query.todate) {
            params.push(query.todate);
            conditions.push(`s.bill_date < CAST($${params.length} AS date) + INTERVAL '1 day'`);
        }

        if (query.storeid) {
            params.push(Number(query.storeid));
            conditions.push(`ss.store_id = $${params.length}`);
        } else if (allowedStoreIds !== null) {
            params.push(allowedStoreIds);
            conditions.push(`ss.store_id = ANY($${params.length}::int[])`);
        }

        const where = conditions.join(' AND ');
        const sql = `
            SELECT
                au.id AS staff_id,
                au.full_name AS staff_name,
                COUNT(DISTINCT s.id)::int AS sales_count,
                COALESCE(SUM(s.cash_amount), 0) AS cash_total,
                COALESCE(SUM(s.digi_amount), 0) AS digi_total,
                COALESCE(SUM(s.total), 0) AS net_total,
                COUNT(DISTINCT sri.id)::int AS return_count,
                COALESCE(SUM(sri.qty * si.price), 0) AS return_value
            FROM sale s
            LEFT JOIN app_user au ON au.id = s.acting_user_id
            LEFT JOIN store_shifts ss ON ss.id = s.shift_id
            LEFT JOIN sale_item si ON si.sale_id = s.id
            LEFT JOIN sale_return_item sri ON sri.sale_item_id = si.id
            WHERE ${where}
            GROUP BY au.id, au.full_name
            ORDER BY net_total DESC
        `;
        return this.manager.query(sql, params);
    }

    getFormatDate(dt:Date){
        let mon = dt.getMonth()+1;
        let dat = dt.getDate();
        return dt.getFullYear() + '-' + (mon < 10 ? ('0'+mon) : mon) 
        + '-' + (dat < 10 ? ('0'+dat) : dat);
    }

    async getSaleReturnItems(saleId:any){
        const query = ` SELECT sri.sale_item_id, sri.qty FROM sale_return_item sri
        inner join sale_item si on si.id = sri.sale_item_id
        inner join sale s on s.id = si.sale_id and s.id = $1`;
        return await this.manager.query(query, [saleId]);
    }

    async getSalesByFreq(fromdate:string,freq:string,count:number){

        const dt = new Date(fromdate);
        let query = ''
        let params: any[] = []

        if(freq === 'daily'){
            const date = new Date(dt.setDate(dt.getDate()+1));
            const other = date.setDate(date.getDate()-count);
            const todate = this.getFormatDate(new Date(other));

            query = `select to_char(s.bill_date,'yyyy-mm-dd') as bill_dt, sum(s.digi_amount) as digital,
            sum(s.cash_amount) as cash, sum(s.total) as total, count(s.bill_no) as orders
            from sale s inner join
            (select date(generate_series($1::date,$2,'1 day')) as dt)x on to_char(s.bill_date,'yyyy-mm-dd') = x.dt::text
            and s.status = 'COMPLETE'
            group by to_char(s.bill_date,'yyyy-mm-dd');`
            params = [todate, fromdate];
        }
        else {
            const date = new Date();
            const other = date.setMonth((date.getMonth()-1)-count);
            const todate = this.getFormatDate(new Date(other));

            query = `
            select x.dt as bill_dt, sum(s.digi_amount) as digital, sum(s.cash_amount) as cash,
            sum(s.total) as total, count(s.bill_no) as orders
            from sale s inner join
            (select months($1,$2) as dt)x on x.dt::text = date_part('year',s.bill_date)||'-'||lpad(date_part('month',s.bill_date)::text,2,'0')
            and s.status = 'COMPLETE'
            group by x.dt
            order by x.dt;`
            params = [fromdate, todate];
        }
        return await this.manager.query(query, params);
    }

    async getCustomerVisitByFreq(fromdate:string,freq:string,count:number){

        const dt = new Date(fromdate);
        let query = ''
        let params: any[] = []

        if(freq === 'daily'){
            const date = new Date(dt.setDate(dt.getDate()+1));
            const other = date.setDate(date.getDate()-count);
            const todate = this.getFormatDate(new Date(other));
            query = `select to_char(x.dt,'yyyy-mm-dd') as date, scv.return_status, count(scv.recent_sale_id)
             from (select date(generate_series($1::date,$2,'1 day')) as dt)x
             left join sale_customer_view scv on x.dt = scv.recent_visit
             where scv.mobile != '0000000000'
             group by x.dt, scv.return_status
              order by x.dt`
            params = [todate, fromdate];
        }
        else {
            const date = new Date();
            const other = date.setMonth((date.getMonth()-1)-count);
            const todate = this.getFormatDate(new Date(other));
            query = `select x.dt as date, scv.return_status, count(scv.recent_sale_id)
            from (select months($1,$2)::text as dt) x
            left join sale_customer_view scv on x.dt = date_part('year',scv.recent_visit::date)||'-'||lpad(date_part('month',scv.recent_visit::date)::text,2,'0')
            where scv.mobile != '0000000000'
            group by x.dt, scv.return_status
             order by x.dt`
            params = [fromdate, todate];
        }
        return await this.manager.query(query, params);
    }

    // async findCustomerSaleByPeriod(custid,year,month){

    //   let day = 31;
    //   if(month == 2)
    //     day = year%4 == 0 ? 29 : 28;
    //   if(month <= 6 && month != 2 && month%2 == 0)
    //     day = 30;
    //   if(month > 8 && month%2 == 1)
    //     day = 30;
      
        
    //     return await this.saleRepository.createQueryBuilder("sale")
	// 	  	.innerJoinAndSelect("sale.customer", "customer")
	//           .leftJoinAndSelect("sale.items", "items")
	//           .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
	//           .leftJoinAndSelect("purchaseitem.product", "product")
	//             .select(['sale','customer','items','purchaseitem','product'])
    //       .where(`sale.status = 'COMPLETE' and items.status = 'Complete' and sale.customer_id = ${custid}
    //        and sale.bill_date between '${year}-${month}-01' and '${year}-${month}-${day}'`)
    //       .orderBy(`sale.billdate`,'DESC')
    //       .getMany();
    // }

    // async findCustomerSaleMonths(custid){
    //     return await this.manager.query(`
    //     select x.yr, x.mon, sum(x.total) as total, count(*) from
    //         (select date_part('year',s.bill_date) as yr, date_part('month',s.bill_date) as mon, s.id, s.total
    //             from sale s 
    //             where s.status = 'COMPLETE' and s.customer_id = ${custid} and s.bill_date between (current_date - 365) and current_date) x 
    //     group by x.yr, x.mon order by x.yr desc, x.mon desc`);
    // }

    async getSales(){
        return await this.manager.query(`   
        select s.id, s.bill_date, s.status , s.customer_id, c.name, c.mobile, ss.itemcount, ss.total 
        from sale s inner join 
        (select sale_id, count(*) as itemcount, sum(qty * price) as total from sale_item group by sale_id) ss on ss.sale_id = s.id
        inner join customer c on c.id = s.customer_id `);
    }

    async getReturns(){
        return await this.manager.query(`   
        select sri.id, si.sale_id, s.bill_no, s.bill_date, sri.created_on, sri.created_by, c."name", c.mobile, 
                si.purchase_item_id, p.title, si.batch, si.exp_date, 
                sri.qty, si.price, sri.reason, sri."comments", sri.status 
                from sale_return_item sri inner join sale_item si on si.id = sri.sale_item_id 
                inner join sale s on s.id = si.sale_id 
                inner join product p on p.id = si.product_id 
                left join customer c on c.id = s.customer_id 
                order by sri.created_on desc`);
    }

    async getEligibleReturns(saleid:any){
        return await this.manager.query(`
            select si.id, p.title, si.batch, si.exp_date, si.price, coalesce(si.qty - returned.total,si.qty - returned.total,si.qty) as eligible
            from sale_item si left join
            (SELECT sale_item_id, sum(sri.qty) as total FROM sale_return_item sri
            inner join sale_item si on si.id = sri.sale_item_id WHERE si.sale_id = $1 GROUP BY sale_item_id) returned ON returned.sale_item_id = si.id
            inner join sale s on s.id = si.sale_id and s.id = $1
            inner join product p on p.id = si.product_id order by p.title`, [saleid]);
    }

    async getReturnItemToAdjust(saleReturnId:any){
        return await this.manager.query(`
        select sri.id, p.title, si.batch, si.exp_date, si.price, si.purchase_item_id as itemid, sri.qty, sri.reason, sri."comments"
        from sale_return_item sri
        inner join sale_item si on si.id = sri.sale_item_id
        inner join product p on p.id = si.product_id
        where sri.id = $1`, [saleReturnId]);
    }

    async findById(id:number){
        return await this.saleRepository.createQueryBuilder("sale")
        .leftJoinAndSelect("sale.customer", "customer")
        .leftJoinAndSelect("sale.items", "items")
        .leftJoinAndSelect("items.product", "product")
        .leftJoinAndSelect("sale.created", "created")
        .leftJoinAndSelect("sale.actinguser", "actinguser")
          .select(['sale','customer','items','product','created.id','created.fullname','actinguser.id','actinguser.fullname'])
          .where('sale.id = :id', { id })
          .getOne();
    }

    async findAllItemsBySale(id:string){
        return this.saleItemRepository.createQueryBuilder('si')
            .where('si.saleid = :id', { id })
            .getMany();
    }

    async findAllEligibleItemsToReturn(id:string){
        return await this.manager.query(
        `select s.sale_id, pii.id, p.title, pii.batch, pii.mfr_date, pii.exp_date, pii.sale_price, p.pack, x.net as balqty from sale_item s
        inner join
        (select sale_id as sid, purchase_item_id as pid, sum(qty) as net from sale_item si where sale_id = $1
        group by sale_id, purchase_item_id) x on x.sid = s.sale_id and x.pid = s.purchase_item_id and x.net > 0 and status is null
        inner join purchase_invoice_item pii on pii.id = s.purchase_item_id
        inner join product p on p.id = pii.product_id`, [id]);
    }

    async findVisits(criteria:any){
        const sql = `
        with relevant_sales as (
            select s.customer_id, s.bill_date
            from sale s
            where s.active = true
              and s.archive = false
              and s.status = 'COMPLETE'
              and s.bill_date >= least(
                  current_date - interval '1 year',
                  current_date - ($1::integer * interval '1 day')
              )
        ), visit_diffs as (
            select customer_id, bill_date,
                   extract(day from (
                       bill_date - lag(bill_date) over (
                           partition by customer_id order by bill_date desc
                       )
                   ))::integer * -1 as days_diff
            from relevant_sales
            where bill_date >= current_date - interval '1 year'
        ), ranked_diffs as (
            select customer_id, days_diff,
                   row_number() over (
                       partition by customer_id order by bill_date desc
                   ) as interval_no
            from visit_diffs
            where days_diff is not null
        ), visit_stats as (
            select customer_id,
                   array_agg(days_diff order by interval_no) as days_diff_array,
                   avg(days_diff) as mean_diff,
                   stddev(days_diff) as stddev_diff
            from ranked_diffs
            where interval_no <= 5
            group by customer_id
        ), recent_visits as (
            select customer_id, max(bill_date) as last_visited
            from relevant_sales
            where bill_date >= current_date - ($1::integer * interval '1 day')
            group by customer_id
        )
        select c.id, c.name, c.mobile, rv.last_visited,
               current_date - date(rv.last_visited) as days_lapsed,
               row(vs.days_diff_array, vs.mean_diff, vs.stddev_diff) as visit_pattern
        from recent_visits rv
        inner join customer c on c.id = rv.customer_id
        left join visit_stats vs on vs.customer_id = rv.customer_id
        order by rv.last_visited desc`
        return await this.manager.query(sql, [criteria.maxdays]);
    }

    async update(id: number, values: Partial<Sale>, userid: number) {
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.saleRepository.findOne({where:{id}});
            await transaction.update(Sale, id, {...obj, ...values, updatedby:userid});
        });
    } 

    async delete(id: number | string, userid: number) {
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const sale = await transaction.findOne(Sale, { where: { id: +id }, relations: ['delivery', 'items'] });
            if (!sale) {
                throw new Error('Sale not found');
            }
            if (sale.status !== 'PENDING' && sale.status !== 'NEW') {
                throw new Error('Only pending sales can be discarded');
            }
            await transaction.update(Sale, id, { isActive: false, isArchived: true, status: 'DISCARDED', updatedby: userid });
            await transaction.update(SaleItem, { saleid: Number(id) } as any, { isActive: false, isArchived: true, updatedby: userid });
            if (sale.delivery?.id) {
                await transaction.update(SaleDelivery, sale.delivery.id, { isActive: false, isArchived: true, updatedby: userid });
            }
        });
    } 
    
    async removeItem(itemid: number | string, userid: number) {
        await this.saleItemRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.update(SaleItem, itemid, {isArchived:true, updatedby:userid});
        });
    }    

    async removeReturnItem(id:any){
        await this.saleReturnItemRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.delete(SaleReturnItem, id);
        });
    }    

}

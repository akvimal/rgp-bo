import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { Customer } from "src/entities/customer.entity";
import { Sale } from "src/entities/sale.entity";
import { EntityManager, Repository } from "typeorm";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { AuditService } from "src/core/audit/audit.service";
import { NIL_MOBILE, cleanEmail, cleanText, likelySamePerson, normaliseMobile, tidyName } from "./customer-rules";

import { isOwnerRole, isManagerRole } from 'src/core/roles';
@Injectable()
export class CustomerService {

    constructor(@InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectEntityManager() private manager: EntityManager,
    private readonly audit: AuditService) { }

    /**
     * Creates or edits a customer (the screens post both here). The name and mobile are checked and cleaned; a mobile
     * already held by another person is refused until the caller confirms it is a different person on the same number
     * (a family often shares one), and an identical name + mobile is always refused.
     */
    async save(dto: CreateCustomerDto & { id?: number | string; confirmduplicate?: boolean }) {
        const id = dto.id ? Number(dto.id) : null;
        const existing = id ? await this.customerRepository.findOne({ where: { id } }) : null;
        if (id && !existing) throw new NotFoundException('Customer not found.');

        const name = tidyName(cleanText(dto.name ?? existing?.name, 80, 'The name'));
        if (!name || name.length < 2) throw new BadRequestException('The customer name is required.');
        const mobile = dto.mobile === undefined ? (existing?.mobile ?? null) : normaliseMobile(dto.mobile);
        if (!mobile && (!existing || existing.mobile)) throw new BadRequestException('The mobile number is required.');

        if (mobile && mobile !== NIL_MOBILE && (!existing || existing.mobile !== mobile || (existing.name || '').trim().toLowerCase() !== name.toLowerCase())) {
            const others = await this.manager.query(
                `select id, name from customer where mobile = $1 and active and not archive and id <> $2 order by id`, [mobile, id ?? 0]);
            if (others.some((o: any) => String(o.name || '').trim().toLowerCase() === name.toLowerCase())) {
                throw new ConflictException(`A customer named ${name} with the mobile ${mobile} already exists.`);
            }
            if (others.length && !dto.confirmduplicate) {
                const who = others.slice(0, 3).map((o: any) => String(o.name || '').trim() || '(no name)').join(', ');
                throw new ConflictException(`The mobile ${mobile} is already used by ${who}${others.length > 3 ? ' and others' : ''}. Confirm that this is a different person on the same number.`);
            }
        }

        const values: any = { name, mobile };
        if (dto.altmobile !== undefined) {
            const alt = normaliseMobile(dto.altmobile);
            if (alt === NIL_MOBILE) throw new BadRequestException('Enter a real alternate mobile number.');
            if (alt && alt === mobile) throw new BadRequestException('The alternate number is the same as the mobile number.');
            values.altmobile = alt;
        } else if (existing?.altmobile && existing.altmobile === mobile) {
            values.altmobile = null;   // the primary was changed to the number held as the alternate
        }
        if (dto.email !== undefined) values.email = cleanEmail(dto.email);
        if (dto.locality !== undefined) values.locality = cleanText(dto.locality, 60, 'The location');
        if (dto.address !== undefined) values.address = cleanText(dto.address, 200, 'The address');
        if (dto.area !== undefined) values.area = cleanText(dto.area, 60, 'The area');
        if (dto.srctype !== undefined) values.srctype = cleanText(dto.srctype, 30, 'The source');
        if (dto.srcdesc !== undefined) values.srcdesc = cleanText(dto.srcdesc, 120, 'The source text');
        try {
            return await this.customerRepository.save(existing ? { ...existing, ...values } : values);
        } catch (e: any) {
            if (String(e?.code) === '23505') throw new ConflictException(`A customer named ${name} with the mobile ${mobile} already exists.`);
            throw e;
        }
    }

    /** Active customers on a mobile, with their bills, for the "already used by" warning. */
    async byMobile(raw: string) {
        let mobile: string | null = null;
        try { mobile = normaliseMobile(raw); } catch { return []; }
        if (!mobile) return [];
        return this.manager.query(
            `select c.id, c.name, c.mobile, count(s.id)::int as bills, max(s.bill_date) as lastvisit
               from customer c left join sale s on s.customer_id = c.id and s.status = 'COMPLETE'
              where c.mobile = $1 and c.active and not c.archive group by c.id order by c.id`, [mobile]);
    }

    /**
     * Deletes a customer. One with no bills, documents, notes or transactions is removed for good; one with history
     * cannot be removed without breaking those records, so it is archived instead (hidden from lists and lookups, the
     * bills keep the name and number). The NIL walk-in is never touched. Business Head and Store Head only.
     */
    async remove(id: number, user: any) {
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
        if (!isManagerRole(role?.name)) throw new ForbiddenException('Only a manager can delete a customer.');
        const c = await this.customerRepository.findOne({ where: { id } });
        if (!c) throw new NotFoundException('Customer not found.');
        if (c.mobile === NIL_MOBILE) throw new BadRequestException('The NIL walk-in customer cannot be deleted.');
        const [n] = await this.manager.query(
            `select (select count(*) from sale where customer_id = $1)::int as bills,
                    (select count(*) from customer_documents where customer_id = $1)::int as documents,
                    (select count(*) from customer_transaction where customer_id = $1)::int as transactions,
                    (select count(*) from grievance where customer_id = $1)::int as grievances,
                    (select count(*) from refill_followup where customer_id = $1)::int as refills`, [id]);
        const history = Number(n.bills) + Number(n.documents) + Number(n.transactions) + Number(n.grievances) + Number(n.refills);
        const who = { id: c.id, name: String(c.name || '').trim(), mobile: c.mobile };
        let result: 'deleted' | 'archived';
        if (history === 0) {
            await this.manager.query(`delete from customer where id = $1`, [id]);
            result = 'deleted';
        } else {
            await this.manager.query(`update customer set active = false, archive = true, updated_on = now() where id = $1`, [id]);
            result = 'archived';
        }
        await this.audit.record({
            userId: user.id, action: result === 'deleted' ? 'customer.deleted' : 'customer.archived', entityType: 'customers', entityId: id,
            summary: `${who.name} ${result}${history ? ` (${n.bills} bills, ${history - Number(n.bills)} other records kept)` : ''}`, details: { customer: who, history: n },
        });
        return { result, customer: who, history: n };
    }

    private async assertBusinessHead(user: any) {
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
        if (!isOwnerRole(role?.name)) throw new ForbiddenException('Only the Business Head can merge customers.');
    }

    /** Numbers held by more than one customer, most likely duplicates first. The NIL walk-in and blank numbers are left out. */
    async duplicates(user: any) {
        await this.assertBusinessHead(user);
        const rows = await this.manager.query(
            `select c.id, c.name, c.mobile, count(s.id)::int as bills, max(s.bill_date) as lastvisit
               from customer c left join sale s on s.customer_id = c.id and s.status = 'COMPLETE'
              where c.active and not c.archive and c.mobile ~ '^[6-9][0-9]{9}$'
                and c.mobile in (select mobile from customer where active and not archive and mobile ~ '^[6-9][0-9]{9}$' group by mobile having count(*) > 1)
              group by c.id order by c.mobile, bills desc, c.id`);
        const groups = new Map<string, any[]>();
        for (const r of rows) {
            if (!groups.has(r.mobile)) groups.set(r.mobile, []);
            groups.get(r.mobile)!.push(r);
        }
        const out = [...groups.entries()].map(([mobile, members]) => {
            let likely = false;
            for (let i = 0; i < members.length && !likely; i++)
                for (let j = i + 1; j < members.length && !likely; j++) likely = likelySamePerson(members[i].name, members[j].name);
            return { mobile, likelysame: likely, bills: members.reduce((t, m) => t + m.bills, 0), members };
        });
        out.sort((a, b) => Number(b.likelysame) - Number(a.likelysame) || b.bills - a.bills);
        return out.slice(0, 300);
    }

    /** Folds duplicate records into one: bills, documents, grievances, refill notes and transactions move to the kept
     *  customer, blanks on it are filled from the others, and the merged records are archived (never deleted). */
    async merge(body: { keepid: number; mergeids: number[] }, user: any) {
        await this.assertBusinessHead(user);
        const keepid = Number(body?.keepid);
        const mergeids = [...new Set((body?.mergeids || []).map(Number))].filter((n) => n && n !== keepid);
        if (!keepid || !mergeids.length) throw new BadRequestException('Pick the customer to keep and at least one to merge into it.');
        if (mergeids.length > 20) throw new BadRequestException('Merge at most 20 records at a time.');
        const result = await this.manager.transaction(async (tx) => {
            const rows = await tx.query(`select * from customer where id = any($1::int[]) and active and not archive for update`, [[keepid, ...mergeids]]);
            if (rows.length !== mergeids.length + 1) throw new NotFoundException('One of the customers does not exist or is already merged.');
            if (rows.some((r: any) => r.mobile === NIL_MOBILE)) throw new BadRequestException('The NIL walk-in customer cannot be merged.');
            const keep = rows.find((r: any) => r.id === keepid);
            const moved: Record<string, number> = {};
            for (const t of ['sale', 'customer_documents', 'customer_transaction', 'grievance', 'refill_followup']) {
                const r = await tx.query(`update ${t} set customer_id = $1 where customer_id = any($2::int[])`, [keepid, mergeids]);
                moved[t] = Array.isArray(r) ? (r[1] ?? 0) : 0;
            }
            for (const col of ['email', 'address', 'locality', 'area', 'alt_mobile']) {
                if (!keep[col]) {
                    const donor = rows.find((r: any) => r.id !== keepid && r[col] && (col !== 'alt_mobile' || r[col] !== keep.mobile));
                    if (donor) await tx.query(`update customer set ${col} = $2 where id = $1`, [keepid, donor[col]]);
                }
            }
            await tx.query(`update customer set active = false, archive = true, updated_on = now() where id = any($1::int[])`, [mergeids]);
            return { keep: { id: keep.id, name: keep.name, mobile: keep.mobile }, merged: rows.filter((r: any) => r.id !== keepid).map((r: any) => ({ id: r.id, name: r.name, mobile: r.mobile })), moved };
        });
        await this.audit.record({
            userId: user.id, action: 'customer.merged', entityType: 'customers', entityId: keepid,
            summary: `${result.merged.length} record(s) merged into ${String(result.keep.name).trim()}`, details: result,
        });
        return result;
    }
    
    async findAll(){
        const [customers, segments, visits] = await Promise.all([
            this.customerRepository.createQueryBuilder('c')
                .where('c.active = :flag', { flag: true }).andWhere('c.archive = false').getMany(),
            this.segmentsByCustomer(),
            this.manager.query(`select customer_id as id, count(*)::int as bills, max(bill_date) as lastvisit from sale
                                 where status = 'COMPLETE' and customer_id is not null group by customer_id`),
        ]);
        const seen = new Map<number, any>(visits.map((v: any) => [+v.id, v]));
        return customers.map(c => Object.assign(c, {
            segment: segments.get(c.id) || 'No purchases',
            bills: seen.get(c.id)?.bills ?? 0,
            lastvisit: seen.get(c.id)?.lastvisit ?? null,
        }));
    }

    /**
     * What a customer buys, from every completed bill line (product.category = 'OTC'; chronic comes from the
     * product's `chronic` property):
     *   OTC only | Chronic only | OTC + Chronic - nothing else was ever bought
     *   Other                                   - anything else, including products not yet categorised
     *   No purchases                            - no completed bill
     */
    private async segmentsByCustomer(): Promise<Map<number, string>> {
        const rows = await this.manager.query(`
            select s.customer_id as id,
              case
                when count(*) filter (where not (coalesce(p.category, '') = 'OTC' or coalesce(p.more_props->>'chronic', '') = 'true')) > 0 then 'Other'
                when count(*) filter (where p.category = 'OTC') > 0
                 and count(*) filter (where coalesce(p.category, '') <> 'OTC') > 0 then 'OTC + Chronic'
                when count(*) filter (where p.category = 'OTC') > 0 then 'OTC only'
                else 'Chronic only'
              end as segment
            from sale_item si
            inner join sale s on s.id = si.sale_id
            inner join product p on p.id = si.product_id
            where s.status = 'COMPLETE' and s.active = true and s.archive = false
              and si.active = true and si.archive = false and s.customer_id is not null
            group by s.customer_id
        `);
        return new Map<number, string>(rows.map((r: any) => [+r.id, r.segment]));
    }
    
    async findById(id:number) {
        return this.customerRepository.findOne({where:{id}});
    }

    async findByMobile(mobile:string) {
        // the primary mobile wins; an alternate number finds the customer when nothing has it as a primary
        const primary = await this.customerRepository.createQueryBuilder('c')
            .where('c.mobile = :mobile', { mobile }).getOne();
        if (primary) return primary;
        return this.customerRepository.createQueryBuilder('c')
            .where('c.altmobile = :mobile and c.active = true and c.archive = false', { mobile })
            .orderBy('c.id', 'ASC').getOne();
    }

    // async findSaleData(criteria:any) {
    //     const query = `select * from customer_sale_view`;
    //     return await this.manager.query(query);
    // }

    async filterByCriteria(criteria:any) {

        const qb = this.customerRepository.createQueryBuilder('c')
            .where('c.active = :flag', { flag: true });

            const conditions:string[] = [];
            const params:any = {};

            for(let index = 0; index < criteria.criteria.length; index++) {
                const c = criteria.criteria[index];
                const paramName = `param${index}`;

                if(c['check'] === 'startswith'){
                    // Only allow whitelisted properties to prevent column injection
                    const allowedProps = ['name', 'mobile', 'email', 'address'];
                    if(!allowedProps.includes(c.property)){
                        throw new Error(`Invalid property: ${c.property}`);
                    }
                    conditions.push(`c.${c.property} ilike :${paramName}`);
                    params[paramName] = `${c.value}%`;
                }
            }

            if(conditions.length > 0){
                const whereClause = conditions.join(criteria.condition === 'any' ? ' or ' : ' and ');
                qb.andWhere(whereClause, params);
            }

            if(criteria.limit)
                qb.limit(criteria.limit);
        return qb.getMany();
    }

    async update(id:any, values:any){
        await this.customerRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.customerRepository.findOne({where:{id}});
            await transaction.update(Customer, id, {...obj, ...values});
        });
      }

      async findSalePeriods(custid){
        const days = 3 * 365; //3yrs
        return await this.manager.query(`
        select x.yr, x.mon, sum(x.total) as total, count(*) from
            (select date_part('year',s.bill_date) as yr, date_part('month',s.bill_date) as mon, s.id, s.total
                from sale s
                where s.status = 'COMPLETE' and s.customer_id = $1 and s.bill_date between (current_date - interval '1 day' * $2) and current_date) x
        group by x.yr, x.mon order by x.yr desc, x.mon desc`, [custid, days]);
    }

    async findDocuments(custid){
        return await this.manager.query(`
        select d.* from customer_documents cd inner join documents d on d.id = cd.document_id where cd.customer_id = $1 order by d.created_on desc`, [custid]);
    }

    async addDocument(cdoc){
        return await this.manager.query(`insert into customer_documents (customer_id,document_id) values ($1,$2)`, [cdoc.customerId, cdoc.documentId]);
    }

    /**
     * Remove document(s) from customer with transaction protection
     * Fixed: Race condition in cascade delete operation
     */
    async removeDocument(custId:number, ids:number[]){
        if (!ids || ids.length === 0) return;

        // Wrap cascade delete in SERIALIZABLE transaction to prevent orphaned records
        return await this.manager.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                // Step 1: Delete from junction table (customer_documents)
                const placeholders = ids.map((_, index) => `$${index + 2}`).join(',');
                await transactionManager.query(
                    `DELETE FROM customer_documents WHERE customer_id = $1 AND document_id IN (${placeholders})`,
                    [custId, ...ids]
                );

                // Step 2: Delete from documents table
                const placeholders2 = ids.map((_, index) => `$${index + 1}`).join(',');
                const result = await transactionManager.query(
                    `DELETE FROM documents WHERE id IN (${placeholders2})`,
                    ids
                );

                return result;
            } catch (error) {
                // Transaction will automatically rollback on error
                throw new Error(`Failed to remove document: ${error.message}`);
            }
        });
    }

    /**
     * Find customer sales for a specific month/year period
     * Fixed: ORDER BY syntax error, leap year calculation, and date handling
     */
    async findCustomerSaleByPeriod(custid,year,month){
        // Use JavaScript's built-in date handling to avoid manual day calculation
        // This correctly handles leap years and month lengths
        const startDate = new Date(year, month - 1, 1);  // First day of month
        const endDate = new Date(year, month, 0);  // Last day of month (day 0 of next month)

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        return await this.saleRepository.createQueryBuilder("sale")
            .innerJoinAndSelect("sale.customer", "customer")
            .leftJoinAndSelect("sale.items", "items")
            .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
            .leftJoinAndSelect("purchaseitem.product", "product")
            .select(['sale','customer','items','purchaseitem','product'])
            .where('sale.status = :saleStatus and items.status = :itemStatus and sale.customer_id = :custid and sale.bill_date between :startDate and :endDate', {
                saleStatus: 'COMPLETE',
                itemStatus: 'Complete',
                custid,
                startDate: startDateStr,
                endDate: endDateStr
            })
            .orderBy('sale.bill_date', 'DESC')  // Fixed: removed backticks, use correct column name
            .getMany();
    }

    /**
     * Get customer statistics for POS display
     * Returns total orders, average bill amount, last purchase date, and frequency badge
     */
    async getCustomerStats(custid: number) {
        const stats = await this.manager.query(`
            SELECT
                COUNT(*) as total_orders,
                COALESCE(AVG(total), 0) as avg_bill,
                MAX(bill_date) as last_purchase,
                MIN(bill_date) as first_purchase
            FROM sale
            WHERE customer_id = $1 AND status = 'COMPLETE'
        `, [custid]);

        if (!stats || stats.length === 0) {
            return {
                totalOrders: 0,
                avgBill: 0,
                lastPurchase: null,
                firstPurchase: null,
                frequencyBadge: 'New'
            };
        }

        const result = stats[0];
        const totalOrders = parseInt(result.total_orders) || 0;
        const avgBill = Math.round(parseFloat(result.avg_bill) || 0);
        const lastPurchase = result.last_purchase;
        const firstPurchase = result.first_purchase;

        // Calculate frequency badge based on order count and recency
        let frequencyBadge = 'New';
        if (totalOrders > 0 && lastPurchase) {
            const daysSinceLastPurchase = Math.floor((new Date().getTime() - new Date(lastPurchase).getTime()) / (1000 * 60 * 60 * 24));

            if (totalOrders >= 10 && daysSinceLastPurchase <= 30) {
                frequencyBadge = 'VIP';
            } else if (totalOrders >= 5 || daysSinceLastPurchase <= 7) {
                frequencyBadge = 'Regular';
            } else if (daysSinceLastPurchase <= 60) {
                frequencyBadge = 'Occasional';
            } else {
                frequencyBadge = 'Returning';
            }
        }

        return {
            totalOrders,
            avgBill,
            lastPurchase,
            firstPurchase,
            frequencyBadge,
            daysSinceLastPurchase: lastPurchase ? Math.floor((new Date().getTime() - new Date(lastPurchase).getTime()) / (1000 * 60 * 60 * 24)) : null
        };
    }
}
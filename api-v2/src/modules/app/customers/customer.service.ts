import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { Customer } from "src/entities/customer.entity";
import { Sale } from "src/entities/sale.entity";
import { EntityManager, Repository } from "typeorm";
import { CreateCustomerDto } from "./dto/create-customer.dto";

@Injectable()
export class CustomerService {

    constructor(@InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectEntityManager() private manager: EntityManager) { }

    async save(createCustomerDto: CreateCustomerDto) {
        return this.customerRepository.save(createCustomerDto);
      }
    
    async findAll(){
        return this.customerRepository.createQueryBuilder('c')
            .where('c.active = :flag', { flag: true }).getMany();
    }
    
    async findById(id:number) {
        return this.customerRepository.findOne({where:{id}});
    }

    async findByMobile(mobile:string) {
        return this.customerRepository.createQueryBuilder('c')
            .where('c.mobile = :mobile', { mobile }).getOne();
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
import { Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";

@Injectable()
export class Stock2Service {

    constructor(@InjectEntityManager() private manager: EntityManager){}
    
    async findAll(criteria:any) {
        const expired = criteria.expired === true;
        const expiryCondition = expired
            ? 'pii.exp_date < current_date + 30'
            : '(pii.exp_date is null or pii.exp_date >= current_date + 30)';
        const availableCondition = criteria.available
            ? `having sum(
                    (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)
                    - coalesce(sold.sold, 0)
                    + coalesce(adjusted.adjusted, 0)
                ) > 0`
            : '';

        const sql = `
            with sold_by_item as (
                select si.purchase_item_id,
                       sum(si.qty) as sold,
                       max(s.bill_date) as last_sale_date
                from sale_item si
                left join sale s on s.id = si.sale_id
                where si.active = true and si.archive = false
                group by si.purchase_item_id
            ), adjusted_by_item as (
                select pq.item_id,
                       sum(pq.qty) as adjusted
                from product_qtychange pq
                where pq.active = true and pq.archive = false
                group by pq.item_id
            ), inventory as (
                select p.id,
                       p.title,
                       p.active,
                       $2::boolean as expired,
                       max(i.invoice_date) as last_purchase_date,
                       date(max(sold.last_sale_date)) as last_sale_date,
                       sum((pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)) as purchased,
                       sum(coalesce(sold.sold, 0)) as sold,
                       sum(coalesce(adjusted.adjusted, 0)) as adjusted,
                       sum(
                           (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)
                           - coalesce(sold.sold, 0)
                           + coalesce(adjusted.adjusted, 0)
                       ) as balance
                from product p
                inner join purchase_invoice_item pii
                    on pii.product_id = p.id
                    and pii.active = true
                    and pii.archive = false
                inner join purchase_invoice i
                    on i.id = pii.invoice_id
                    and i.active = true
                    and i.archive = false
                left join sold_by_item sold on sold.purchase_item_id = pii.id
                left join adjusted_by_item adjusted on adjusted.item_id = pii.id
                where p.active = $1
                  and p.archive = false
                  and ${expiryCondition}
                group by p.id, p.title, p.active
                ${availableCondition}
            ), monthly_sales as (
                select si.product_id,
                       date_trunc('month', s.bill_date) as sale_month,
                       count(distinct s.customer_id) as total_customers,
                       count(s.bill_no) as total_orders,
                       sum(si.qty) as total_qty
                from sale_item si
                inner join sale s on s.id = si.sale_id
                where s.bill_date >= current_date - interval '6 months'
                  and s.active = true
                  and s.archive = false
                  and s.status = 'COMPLETE'
                  and si.active = true
                  and si.archive = false
                group by si.product_id, date_trunc('month', s.bill_date)
            ), sales_aggregate as (
                select product_id,
                       avg(total_customers) as average_customers,
                       max(total_customers) as highest_customers,
                       avg(total_orders) as average_orders,
                       max(total_orders) as highest_orders,
                       avg(total_qty) as average_sales,
                       max(total_qty) as highest_sales
                from monthly_sales
                group by product_id
            )
            select iv.*, av.product_id, av.average_customers,
                   av.highest_customers, av.average_orders, av.highest_orders,
                   av.average_sales, av.highest_sales
            from inventory iv
            left join sales_aggregate av on av.product_id = iv.id
            order by av.highest_customers desc nulls last, iv.title`;

        return await this.manager.query(sql, [criteria.active === true, expired]).then(data => {
            data.forEach(rec => {
                if(rec['balance']){
                    rec['balance'] = +rec['balance'];
                }
                if(rec['average_sales']){
                    const pcnt = (rec['balance']-rec['average_sales'])/rec['average_sales']
                    rec['level'] = +Math.round(pcnt * 100);
                }
            });
            
            return data;
        });
    }

    async getMonthAvailableList(){
        const sql = `select to_char(exp_date,'yyyy-mm-dd') as exp_date, count(item_id) as products, sum(balance) as available
        from product_items_view where active = true and balance > 0 group by exp_date order by exp_date`;
        return await this.manager.query(sql);
    }

    findProductsByExpiries(month:string){
        const sql = `select item_id, title, batch, balance 
            from product_items_view where active = true and exp_date = '${month}' and balance > 0`;
        return this.manager.query(sql);
    }

    async findProductItemsById(id:number) {
        const purchases = await this.manager.query(`select * from product_items_view where id = ${id} order by invoice_date desc`);
        const sales = await this.manager.query(`select * from product_sale_monthly_view where product_id = ${id} order by sale_month desc`);
        const customers = await this.manager.query(`
        select c.id, c."name", c.mobile, date(DATE_TRUNC('month', s.bill_date)) as sale_month, 
sum(si.qty) as total_qty, date(max(s.bill_date)) as recent from sale_item si 
inner join sale s on s.id = si.sale_id and si.product_id = ${id}
inner join customer c on s.customer_id = c.id
group by c.id, c."name", c.mobile, s.bill_date
order by recent desc`);

        return {purchases,sales,customers}
    }
}

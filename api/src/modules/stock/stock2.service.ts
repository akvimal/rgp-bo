import { Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";

@Injectable()
export class Stock2Service {

    constructor(@InjectEntityManager() private manager: EntityManager){}
    
    async findAll(criteria:any) {
        
        let sql = `select * from product_items_agg_view iv
                        left join product_sale_agg_view av on av.product_id = iv.id`;

        const arr = [];
        if(criteria.available){
            arr.push(`iv.balance > 0`);
        }

        arr.push(`iv.active = ${criteria.active}`);
        arr.push(`iv.expired = ${criteria.expired}`);

        if(arr.length > 0) {
            sql += ` where ${arr.join(' and ')}`
        }
        sql += ` order by av.highest_customers desc`
        return await this.manager.query(sql).then(data => {
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
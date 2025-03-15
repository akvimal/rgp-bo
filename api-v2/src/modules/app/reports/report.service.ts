import { Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";

@Injectable()
export class ReportService {

    constructor(@InjectEntityManager() private manager: EntityManager) { }

    async customerOrders(id:number){
      let sql = `select s.bill_no, s.bill_date, current_date - date(s.bill_date)
      from sale s
      inner join customer c on c.id = s.customer_id and c.id = ${id}
      order by s.bill_date desc`;
      return await this.manager.query(sql);
    }

    async saleQuery(criteria:any){
      let sql = '';
      if(criteria.report == 'sale'){
        sql = `
        select s.bill_date, s.bill_no, s.more_props, c."name" || ' (' || c.mobile || ')' as customer, round(s.total) as sale_total, 
        p.title as product, (batch || ' (' || to_char(exp_date, 'Mon-YY') || ')') as batch, si.mrp_cost as MRP, si.qty, si.price as price, si.total as item_total
        from sale s 
        inner join sale_item si on si.sale_id = s.id 
        inner join product p on p.id = si.product_id 
        left join customer c on c.id = s.customer_id 
        where s.status = 'COMPLETE' and s.bill_date between '${criteria['begin']}' and date '${criteria['end']}' + 1 `;

        if(criteria.product){
            if(criteria.product.category !== '')
              sql += ` and p.category = '${criteria.product.category}'`;
            if(criteria.product.props && criteria.product.props.length > 0){
              criteria.product.props.forEach(p => {
                if(p.value &&  p.value !== ''){
                  sql += ` and p.more_props->>'${p.id}' = '${p.value}'`
                }
              })
              sql += `and p.category = '${criteria.product.category}'`
            }
          }
          sql += ` order by s.bill_date desc, s.bill_no desc`
        // and s.order_type = '' 
        // and s.delivery_type = ''
      }
      return await this.manager.query(sql);
    }

}
import { Component } from "@angular/core";
import { CalculatorService } from "../../calculator.service";
import { CustomersService } from "../../customers/customers.service";

@Component({
    selector:'app-sale-reminder',
    templateUrl: 'sale-reminder.component.html'
})
export class SaleReminderComponent {

    customers:any[]=[];

    constructor(private customerService:CustomersService, private calc: CalculatorService){}

    ngOnInit(){
        this.customerService.getSaleData({}).subscribe((data:any) => {
            this.customers = data.map((item:any)=> {
                // const dt = new Date(item.last_bill_date)
                return {
                    custname: item.name,
                    custmobile: item.mobile,
                    customerid: item.customer_id,
                    sincedate: item.since,
                    sincemonths: Math.round(item.since_months),
                    tilldatetotal: item.tilldate_total,
                    recentvisit: item.recent_visit,
                    recentsaleid: item.recent_sale_id,
                    recenttotal: item.recent_total,
                    sincerecentweeks: Math.round(item.since_recent_weeks),
                    consumeweeks: item.consume_weeks,
                    remindcustomer: (item.consume_weeks - item.since_recent_weeks) < 0 
                    // agewithus: item.age_in_months,
                    // lastbillid: item.last_bill_id,
                    // lastbilldt: item.last_bill_date,
                    // monthsago: item.visit_months_ago,
                
                }
                {
                    
                  }
            }
        )});
    }

}
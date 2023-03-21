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
                    agewithus: item.age_in_months,
                    lastbilldt: item.last_bill_date,
                    monthsago: item.visit_months_ago
                }
            }
        )});
    }

}
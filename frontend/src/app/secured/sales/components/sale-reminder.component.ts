import { Component } from "@angular/core";
import { SaleService } from "../sales.service";

@Component({
    selector:'app-sale-reminder',
    templateUrl: 'sale-reminder.component.html'
})
export class SaleReminderComponent {

    result = [];
    loading = true;

    constructor(private service:SaleService){}

    ngOnInit(){
        this.service.findCustomerSalePattern({days:90}).subscribe((data:any) => {
            this.result = data.map(d => {
                
                let interval = '';
                let avgdays= 0;
                let devdays = 0;
                const pattern = d['visit_pattern'];
                
                if(pattern!=='' && pattern.indexOf('\"') > 0){
                    const str2pos = pattern.lastIndexOf('\"');
                    const encodedInterval = (pattern.substring(pattern.indexOf('\"')+2,str2pos-1));
                    // console.log(interval.split(',').reverse());
                    interval = encodedInterval.split(',');//.reverse();
                    avgdays = Math.round(+pattern.substring(str2pos+2, pattern.lastIndexOf(',')));
                    devdays = Math.round(+pattern.substring(pattern.lastIndexOf(',')+1,pattern.length-1));
                }
                this.loading = false;
                return {...d, interval, avgdays, devdays}
            });
        });
    }

}
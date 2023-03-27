import { Component } from "@angular/core";
import { DateUtilService } from "./date-util.service";
import { SaleService } from "./sales/sales.service";

@Component({
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent {

    saleData = []
    customerData:any = []
 
    fromdate = '';
    freq = 'daily';
    count = '7';

    custfromdate = '';
    custfreq = 'monthly';
    custcount = '7';
 
    constructor(private saleService:SaleService, private dateService:DateUtilService){}
    
    ngOnInit(){
        this.fromdate = this.dateService.getFormatDate(new Date());
        this.custfromdate = this.dateService.getFormatDate(new Date());
        this.viewsale();
        this.viewcustomer();
    }
    
    viewsale(){
        this.saleService.getSaleData({fromdate:this.fromdate,freq:this.freq,count:this.count})
        .subscribe((data:any) => {
            this.saleData = data.map((dt:any) => {
                return {
                    name:this.freq==='daily'?this.dateService.getDateMonth(dt.date):this.dateService.getMonthYear(dt.date),
                    value:Math.round(dt.sale)||0
                }
            })
        })
    }

    viewcustomer(){
        this.saleService.getCustomerData({fromdate:this.custfromdate,freq:this.custfreq,count:this.custcount})
        .subscribe((data:any) => {
            const arr:any = []
            data.forEach((d:any) => {
               const founddt = arr.find((a:any) => a.name === d.date)
               const dtfrm = this.custfreq==='daily'?this.dateService.getDateMonth(d.date):this.dateService.getMonthYear(d.date);
               if(founddt) {
                if(founddt.series){
                    founddt.series.push({name: d.return_status,value:d.count})
                }
                else {
                    founddt['series'] = [{name: d.return_status,value:d.count}]
                }
                }
                else {
                    arr.push({name: dtfrm, series: [{name: d.return_status,value:d.count}]})
                }
            });
            this.customerData = [...arr]
            
            // ((dt:any) => {
                // return {
                //     name:this.freq==='daily'?this.getDateMonth(dt.date):this.getMonthYear(dt.date),
                //     value:Math.round(dt.sale)||0
                // }
            // })
        })
    }


   

}
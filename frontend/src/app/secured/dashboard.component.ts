import { Component } from "@angular/core";
import { SaleService } from "./sales/sales.service";

@Component({
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent {

    saleData = []
 
    fromdate = '';
    freq = 'daily';
    count = '7';
 
    constructor(private saleService:SaleService){}
    
    ngOnInit(){
        this.fromdate = this.getFormatDate(new Date())
        this.fetch()
    }
    
    getFormatDate(dt:Date){
        let mon = dt.getMonth()+1;
        let dat = dt.getDate();
        return dt.getFullYear() + '-' + (mon < 10 ? ('0'+mon) : mon) 
        + '-' + (dat < 10 ? ('0'+dat) : dat);
    }

    view(){
        this.fetch()
    }

    fetch(){
        this.saleService.getSaleData({fromdate:this.fromdate,freq:this.freq,count:this.count}).subscribe((data:any) => {
            this.saleData = data.map((dt:any) => {
                return {name:dt.date,value:dt.sale||0}
            })
        })
    }

}
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
    
    view(){
        this.fetch()
    }

    fetch(){
        this.saleService.getSaleData({fromdate:this.fromdate,freq:this.freq,count:this.count})
        .subscribe((data:any) => {
            this.saleData = data.map((dt:any) => {
                return {
                    name:this.freq==='daily'?this.getDateMonth(dt.date):this.getMonthYear(dt.date),
                    value:Math.round(dt.sale)||0
                }
            })
        })
    }

    getFormatDate(dt:Date){
        let mon = dt.getMonth()+1;
        let dat = dt.getDate();
        return dt.getFullYear() + '-' + (mon < 10 ? ('0'+mon) : mon) 
        + '-' + (dat < 10 ? ('0'+dat) : dat);
    }

    getMonthYear(dtstr:string){
        const dt = new Date(dtstr+'-01');
        let mon = dt.getMonth()+1;
        return this.parseMonthText(mon) + '-' + dt.getFullYear()%2000;
    }

    getDateMonth(dtstr:string){
        const dt = new Date(dtstr);
        let mon = dt.getMonth()+1;
        return dt.getDate() +'-'+this.parseMonthText(mon);
    }
    parseMonthText(mon:number){
        let text = ''
        switch (mon) {
            case 1:
                text = 'Jan'
                break;
            case 2:
                text = 'Feb'
                break;
            case 3:
                text = 'Mar'
                break;
            case 4:
                text = 'Apr'
                break;
            case 5:
                text = 'May'
                break;
            case 6:
                text = 'Jun'
                break;
            case 7:
                text = 'Jul'
                break;
            case 8:
                text = 'Aug'
                break;
            case 9:
                text = 'Sep'
                break;
            case 10:
                text = 'Oct'
                break;
            case 11:
                text = 'Nov'
                break;
            case 12:
                text = 'Dec'
                break;
                        
            default:
                break;
        }
        return text;
    }

}
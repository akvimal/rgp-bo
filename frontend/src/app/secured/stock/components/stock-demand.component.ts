import { Component } from "@angular/core";
import { DateUtilService } from "../../date-util.service";
import { StockService } from "../stock.service";

@Component({
    templateUrl: './stock-demand.component.html',
    styles: [
        `
        .batch {color:blue;font-style:italic;font-size:smaller}
        .adj-label {color:#aaa;font-weight:bold;margin-bottom:.5em;}
        `
    ]
})
export class StockDemandComponent {

    items:[] = []
    fromdate:any = '';
    todate:any = '';
    incother:boolean = false;

    constructor(private stockService:StockService, private dateUtilService:DateUtilService) {}

    ngOnInit() {
        this.fromdate = this.dateUtilService.getOtherDate(new Date(),-90);
        this.todate = this.dateUtilService.getFormatDate(new Date());
        this.incother = false; 
        this.filter();
    }

    filter(){
console.log('incother: ',this.incother);

        this.stockService.findDemand(this.fromdate,this.todate,!this.incother).subscribe((data:any) => {
            this.items = data;
        });
    }
}
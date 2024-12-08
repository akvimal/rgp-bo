import { Component } from "@angular/core";
import { DateUtilService } from "src/app/secured/date-util.service";
import { InvoiceService } from "src/app/secured/purchases/invoices/invoices.service";
import { StockService } from "../stock.service";
import { Stock2Service } from "../stock2.service";

@Component({
    templateUrl: 'stock-products.component.html'
})
export class StockProductsComponent {

    criteria = {active:true, available:true, expired:false, starts:true}
    products:any = []
   
    constructor(private service: Stock2Service){}

    ngOnInit(){
        this.fetch();
    }

    fetch(){
        this.service.findAll({criteria:this.criteria}).subscribe(data => this.products = data);
    }

}
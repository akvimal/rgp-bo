import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Stock2Service } from "../stock2.service";

@Component({
    templateUrl: './stock-product-items.component.html'
})
export class StockProductItemsComponent {

    data:any = {};
    product:any = {};
   
    constructor(private route:ActivatedRoute, private service: Stock2Service){}

    ngOnInit(){
        this.route.params.subscribe(params => {
            this.service.findByProduct(params['id']).subscribe((data:any) => {
                if(data.purchases.length > 0){
                    this.product = data.purchases[0];
                }
                data.purchases.forEach(d => {
                    d['balance'] = d.purchased-d.sold-d.adjusted;
                });
                data.sales.forEach(d => {
                    d['long'] = this.isAfterDays(d.sale_month, 180);
                });
                data.customers.forEach(d => {
                    d['long'] = this.isAfterDays(d.sale_month, 180);
                });
                this.data = data;
            });
        })
    }

    isAfterDays(date,days){
        const month = new Date(date).getTime();
        const current = (new Date()).getTime();
        const nodays = (current-month)/1000/60/60/24;
        return nodays > days;
    }
}
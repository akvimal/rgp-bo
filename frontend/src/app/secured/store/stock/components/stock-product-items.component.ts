import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ProductsService } from "src/app/secured/products/products.service";
import { Stock2Service } from "../stock2.service";

@Component({
    templateUrl: './stock-product-items.component.html'
})
export class StockProductItemsComponent {

    data:any = {};
    product:any = {};

    displayQtyAdjForm: boolean = false;
    selectedItem:any;

    constructor(private route:ActivatedRoute, private service: Stock2Service, private prodService:ProductsService){}

    ngOnInit(){
        this.route.params.subscribe(params => {
            this.service.findByProduct(params['id']).subscribe((data:any) => {
                if(data.purchases.length > 0){
                    this.product = data.purchases[0];
                }
                data.purchases.forEach(d => {
                    d['balance'] = +(+d.purchased - +d.sold + +d.adjusted);
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

    showQtyDialog(item:any) {
        this.selectedItem = item;
        this.displayQtyAdjForm = true;
    }

    closeAdjForm(event:any){
        console.log(event);
        this.displayQtyAdjForm = false;
    }

    toggleActive(product){
        this.prodService.update(product.id, {isActive:!product.active}).subscribe((data:any) => {
            if(data.affected == 1){
                this.product['active'] = !product.active;
            }
        })
    }
}
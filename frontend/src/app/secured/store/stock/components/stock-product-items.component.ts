import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ProductsService } from "src/app/secured/products/products.service";
import { StockService } from "../stock.service";

@Component({
    templateUrl: './stock-product-items.component.html'
})
export class StockProductItemsComponent {

    data:any = {};
    product:any = {};

    displayQtyAdjForm: boolean = false;
    selectedItem:any;

    constructor(private route:ActivatedRoute, private service: StockService, private prodService:ProductsService){}

    ngOnInit(){
        this.route.params.subscribe(params => {
            this.service.findByProduct(params['id']);
            this.service.getProductStats().subscribe((data:any) => {
                if(data.purchases.length > 0){
                    this.product = data.purchases[0];
                }
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
        this.displayQtyAdjForm = false;
        this.service.findByProduct(this.selectedItem.id);
        // this.service.refreshProducts();
    }

    toggleActive(product){
        this.prodService.update(product.id, {isActive:!product.active}).subscribe((data:any) => {
            if(data.affected == 1){
                this.product['active'] = !product.active;
            }
        })
    }

    zeroStock(prodid, itemid,adjQty){
        const obj =  {itemid,
        reason: 'Other',
        qty: -1* +adjQty};
        this.service.updateQty(obj)
            .subscribe(data => {
                this.service.findByProduct(prodid);
        });
    }
}
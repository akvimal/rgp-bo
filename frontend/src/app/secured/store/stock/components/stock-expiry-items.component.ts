import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ProductsService } from "src/app/secured/products/products.service";
import { StockService } from "../stock.service";

@Component({
    templateUrl: './stock-expiry-items.component.html'
})
export class StockExpiryItemsComponent {

    data:any = {};
    product:any = {};
    month:string;

    displayQtyAdjForm: boolean = false;
    selectedItem:any;

    constructor(private route:ActivatedRoute, private service: StockService, private prodService:ProductsService){}

    ngOnInit(){
        this.route.params.subscribe(params => {
            this.month = params['month'];
            this.service.getProductsByExpiryMonths(this.month).subscribe((data:any) => {
                this.data = data;
            });
        });
    }

    showQtyDialog(item:any) {
        this.selectedItem = item;
        this.displayQtyAdjForm = true;
    }

    closeAdjForm(event:any){
        this.displayQtyAdjForm = false;
        this.service.findByProduct(this.selectedItem.id);
    }

}
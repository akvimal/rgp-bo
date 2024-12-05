import { Component } from "@angular/core";
import { ProductPrice } from "../../product-price.model";
import { ProductsService } from "../../products.service";

@Component({
    templateUrl: 'product-price.component.html'
})
export class ProductPriceComponent {

    criteria = {active:true,title:''}

    products:any[] = [];

    constructor(private service:ProductsService){}

    ngOnInit(){ 
       this.filter();
    }

    filter(){
        this.service.findAllPrices(this.criteria).subscribe((data:any)=> this.products = data);
    }

    onRowEditInit(product: ProductPrice) {
    //  console.log('onRowEditInit',product);
    }

    onRowEditSave(product: ProductPrice) {
        console.log('onRowEditSave',product);
        if(product['price_id']){ //update price
            console.log('update price');
            this.service.updatePrice(product).subscribe(data => {
                console.log(data);
            })
        }
        else { //add new price to the rpduct
            console.log('add price');
            this.service.addPrice(product).subscribe(data => {
                console.log(data);
            })
        }
    }

    onRowEditCancel(product: ProductPrice, index: number) {
        // console.log('onRowEditCancel',product);
        // console.log('index: ',index); 
    }
}
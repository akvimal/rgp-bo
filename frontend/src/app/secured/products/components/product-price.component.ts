import { Component } from "@angular/core";
import { ProductPrice } from "../product-price";
import { ProductsService } from "../products.service";

@Component({
    templateUrl: 'product-price.component.html'
})
export class ProductPriceComponent {

    products:ProductPrice[] = [];

    constructor(private service:ProductsService){}

    ngOnInit(){ 
       this.service.findAllPrices().subscribe((data:any) => {
        console.log(data);
        data.forEach((item:any) => {
            if(item['our_sale_price'] > 0){
            const margin = (item['our_sale_price'] - item['our_max_ptr'])/item['our_max_ptr'];
            item['margin'] = margin;
            }
        });
        
        this.products = data;
        });
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
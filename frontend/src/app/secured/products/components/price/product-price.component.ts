import { Component } from "@angular/core";
import { ProductPrice } from "../../product-price.model";
import { ProductsService } from "../../products.service";

@Component({
    templateUrl: 'product-price.component.html'
})
export class ProductPriceComponent {

    criteria = {active:true,title:''}
    productid=0;

    products:any[] = [];
    showPriceChange:boolean = false;

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

    changePrice(productid:number){
        this.productid=productid;
        this.showPriceChange = true;
    }

    changed(event:any){
        console.log(event);
        this.showPriceChange = false;
        //update price item
    }
}
import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { DateUtilService } from "src/app/secured/date-util.service";
import { ProductsService } from "../../products.service";

@Component({
    selector: 'app-product-price-change',
    templateUrl: 'product-price-change.component.html'
})
export class ProductPriceChangeComponent {

    @Input() productid;
    @Output() added = new EventEmitter();

    empty = { sale: 0, date: '', reason: '', comments: '' };
    price:any;
    current:any = {};

    constructor(private service:ProductsService, private dateService:DateUtilService){}

    ngOnChanges(changes:SimpleChanges){
        // console.log(changes.productid);
        if(changes.productid.currentValue > 0){
            this.service.findPricesById(changes.productid.currentValue).subscribe(data => {
                this.price = this.empty;
                this.price['sale'] = data['price']['price'];
                this.current = data;
            });
        }
    }

    ngOnInit(){
        this.price = this.empty;
        this.price['date'] = this.dateService.getFormatDate(new Date());
    }

    onSave(){
        this.service.addPrice({id:this.productid, ...this.price}).subscribe(data => {            
            this.added.emit(data);
        });
    }

    calculate(event:any){
        const price = +event.target.value;
        
        const ptr = +this.current.price.ptr;
        const mrp = +this.current.price.mrp;
        
        if(price > mrp){ event.target.value = mrp; }
        if(price < ptr){ event.target.value = ptr; }

        const margin = ((price-ptr)/ptr) * 100;
        const discount = ((mrp-price)/mrp) * 100;
        console.log(margin,discount);
        this.current.price.margin = Math.round(margin);
        this.current.price.discount = Math.round(discount);
        console.log(this.current);
        
    }

    priceData(event:any){
        this.price.sale = event.price;
    }

    isValid(){
        return this.price.save != '' && this.price.date != null 
        && this.price.reason != '';
    }
}
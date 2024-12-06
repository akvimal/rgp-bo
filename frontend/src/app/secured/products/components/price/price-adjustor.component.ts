import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

@Component({
    selector: 'app-price-adjustor',
    templateUrl: './price-adjustor.component.html'
})
export class PriceAdjustorComponent{

    @Input() price;
    @Output() ready = new EventEmitter();

    data:any = {};
    //should be passed from calling component for the product
    // range = {category:'Generic',margin:[50,-1], discount: [-1,80]}
    
    ngOnChanges(changes:SimpleChanges){
        if(changes.price && changes.price.currentValue){
            this.data = changes.price.currentValue;
        }
    }

    ngOnInit(){
        if(!this.price){
            this.data = {category:'',ptr:'',mrp:'',price:''}
        }
    }

    calculate(event:any){
        let price = +event.target.value;
        
        const ptr = +this.price.ptr;
        const mrp = +this.price.mrp;
        
        if(price > mrp){ event.target.value = mrp; }
        if(price < ptr){ event.target.value = ptr; }

        //Below logic is for applying minimum margin and maximum discount
        //==========
        // let minmargin = +ptr + +ptr * (+this.range.margin[0]/100);
        // if (minmargin >= mrp){
        //     price = mrp;
        // }
        // else {
        //     let maxdisc = +mrp - +mrp * (+this.range.discount[1]/100);
            
        //     if(minmargin < maxdisc ){
        //         price = maxdisc;
        //     }
        //     else if (minmargin > maxdisc ){
        //         price = minmargin;
        //     }
        // }
        // event.target.value = price;

        const margin = ((price-ptr)/ptr) * 100;
        const discount = ((mrp-price)/mrp) * 100;
        
        this.price.margin = Math.round(margin);
        this.price.discount = Math.round(discount);
        
        this.ready.emit(this.data);
    }

}
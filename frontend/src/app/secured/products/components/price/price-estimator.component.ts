import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

@Component({
    selector: 'app-price-estimator',
    templateUrl: './price-estimator.component.html'
})
export class PriceEstimatorComponent{

    data:any = {};
    range = [
        {category: 'Generic',margin:[50,-1], discount: [-1,80]},
        {category: 'Non Generic',margin:[10,-1], discount: [-1,10]},
        {category: 'Other',margin:[0,-1], discount: [-1,0]}
    ]
    
    ngOnInit(){
        this.data = {category:'',ptr:'',mrp:'',price:''}
    }

    getTypes(){
        return this.range.map(c => c.category);
    }

    calculate(){
        
         const range = this.range.find(c=>c.category == this.data.category)
         const {margin,discount} = range;

         if(this.data.ptr > 0 && this.data.mrp > 0){
          
            let minmargin = +this.data.ptr + +this.data.ptr * (+margin[0]/100);
            if (minmargin >= this.data.mrp){
                this.data.price = this.data.mrp;
            }
            else {
                let maxdisc = +this.data.mrp - +this.data.mrp * (+discount[1]/100);
                
                if(minmargin < maxdisc ){
                    this.data.price = maxdisc.toFixed(2);
                }
                else if (minmargin > maxdisc ){
                    this.data.price = minmargin.toFixed(2);
                }
            }
            
            this.data.margin = Math.round(((this.data.price-this.data.ptr)/this.data.ptr) * 100);
            this.data.discount = Math.round(((this.data.mrp-this.data.price)/this.data.mrp) * 100);
         }
    }

}
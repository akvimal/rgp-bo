import { Injectable } from "@angular/core";

@Injectable({
    providedIn: "root"
})
export class ProductUtilService {

    calcSalePrice(ptr:number,mrp:number,tax:number){
        const maxm = 2.5
        const minm = 1.3
        const mins = 0.5
        let mrp2 = mrp;
        let m1 = ptr * minm;
        let m2 = ptr * maxm;
        let s1 = mrp2 - (mrp2 * mins);
        
        let price = 0;
        
        if(m1 > mrp)
            price = mrp;
        else {
            if(s1 < m1) 
                price = m1;
            else if (s1 > m1 && s1 <= m2)
                price = s1;
            else if (s1 > m2)
                price = m2;
        }
        return price;
    }
    
    getMargin(ptr:number,sp:number) {        
        return Math.round(((sp-ptr) / ptr) * 100);
    }

    getSaving(mrp:number,sp:number) {
        return ((mrp-sp) / mrp) * 100;
    }
}
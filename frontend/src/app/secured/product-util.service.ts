import { Injectable } from "@angular/core";

@Injectable({
    providedIn: "root"
})
export class ProductUtilService {

    calcSalePrice(ptr:number,mrp:number,tax:number){
        const maxm = 2.5
        const minm = 1.3
        const mins = 0.5
        let mrp2 = mrp;// / (1 + (tax/100));
        let m1 = ptr * minm;
        let m2 = ptr * maxm;
        let s1 = mrp2 - (mrp2 * mins);
        
        let price = 0;
        console.log(`m1[${m1}],m2[${m2}],s1[${s1}]`);
        
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
        // let price = m2;
        // if(m2 > s1 ) {
        //     price = (s1 <= m1) ? m1 : s1;
        // }
        
        // const mrpBeforeTax = mrp / (1 + (tax/100));
        
        // return (price > mrpBeforeTax ? mrpBeforeTax : price).toFixed(2);
        return price;
    }
}
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Product } from "./product.model";
import { environment } from "./../../../environments/environment";
import { ProductPrice } from "./product-price.model";

@Injectable({
    providedIn: 'root'
})
export class ProductsService {

    apiurl = `${environment.apiHost}/products`;

    constructor(private http:HttpClient){}

    pricingReview(){ return this.http.get<any>(`${environment.apiHost}/pricing/review`); }
    pricingPerformance(){ return this.http.get<any>(`${environment.apiHost}/pricing/performance`); }
    pricingImpact(){ return this.http.get<any>(`${environment.apiHost}/pricing/impact`); }
    pricingRules(){ return this.http.get<any>(`${environment.apiHost}/pricing/rules`); }
    pricingSaveRules(values:any){ return this.http.put<any>(`${environment.apiHost}/pricing/rules`, { values }); }
    pricingPriceNew(productid:number){ return this.http.post<any>(`${environment.apiHost}/pricing/price-new`, { productid }); }
    pricingBulkSet(body:{ productids:number[]; mode:'MRP'|'PCT_OFF'; pct?:number; preview?:boolean }){ return this.http.post<any>(`${environment.apiHost}/pricing/bulk-set`, body); }
    pricingPriceNewAll(){ return this.http.post<any>(`${environment.apiHost}/pricing/price-new-all`, {}); }
    pricingProductCheck(productid:number, price?:number){ return this.http.get<any>(`${environment.apiHost}/pricing/product/${productid}/check`, { params: price !== undefined ? { price: String(price) } : {} }); }
    pricingApply(productid:number){ return this.http.post<any>(`${environment.apiHost}/pricing/apply`, { productid }); }
    pricingCheck(){ return this.http.get<any>(`${environment.apiHost}/pricing/check`); }
    pricingMode(){ return this.http.get<any>(`${environment.apiHost}/pricing/mode`); }
    pricingSaveMode(body:any){ return this.http.put<any>(`${environment.apiHost}/pricing/mode`, body); }
    pricingPreviewMode(body:any){ return this.http.post<any>(`${environment.apiHost}/pricing/mode/preview`, body); }
    pricingApplyRaises(){ return this.http.post<any>(`${environment.apiHost}/pricing/apply-raises`, {}); }
    pricingApplyCuts(){ return this.http.post<any>(`${environment.apiHost}/pricing/apply-cuts`, {}); }
    pricingPolicy(){ return this.http.get<any>(`${environment.apiHost}/pricing/policy`); }
    pricingSavePolicy(key:string, floor:number, cap:number, usual?:number){ return this.http.put<any>(`${environment.apiHost}/pricing/policy/${key}`, { floor, cap, usual }); }
    pricingAddException(productid:number, reason:string, until:string){ return this.http.post<any>(`${environment.apiHost}/pricing/exceptions`, { productid, reason, until }); }

    packCheck(){
        return this.http.get<any[]>(`${this.apiurl}/pack-check`);
    }

    /** recent purchases, stock and sales of one product on the pack check list */
    /** fills the dosage form of products that have none from their titles; without apply it is a preview */
    fillDosageForms(apply:boolean){ return this.http.post<any>(`${this.apiurl}/dosage-forms/fill`, {}, { params: apply ? { apply: '1' } : {} }); }

    packEvidence(id:number){ return this.http.get<any>(`${this.apiurl}/pack-check/${id}`); }

    /** what changing the pack would do to the stock */
    packImpact(id:number, pack:number){ return this.http.get<any>(`${this.apiurl}/pack-check/${id}/impact`, { params: { pack: String(pack) } }); }

    packDismiss(id:number, body:{reason:string, note?:string}){ return this.http.post<any>(`${this.apiurl}/pack-check/${id}/dismiss`, body); }

    packFix(id:number, body:{pack:number, expectedPack:number, reason:string, note?:string, confirm:boolean}){ return this.http.post<any>(`${this.apiurl}/pack-check/${id}/fix`, body); }

    findAll(criteria:any){
        return this.http.post(this.apiurl,{criteria});
    }

    findByCriteria(criteria:any){
        return this.http.post(`${this.apiurl}/filter`, criteria);
    }

    findByCriteria2(criteria:any){
        return this.http.post(`${this.apiurl}/filter2`, criteria);
    }

    findAllPrices(criteria:any){
        return this.http.post(`${this.apiurl}/prices`,criteria);
    }

    findById(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }    
    findPricesById(prodid:any){
        return this.http.get(`${this.apiurl}/prices/${prodid}`);
    }    
    search(text:any){
        return this.http.get(`${this.apiurl}/search=${text}`);
    }

    save(product:Product){
        return this.http.post(`${this.apiurl}`,product);
    }

    update(id:number, props:any){
        return this.http.put(`${this.apiurl}/${id}`,props);
    }
    
    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    addPrice(data:any){
        return this.http.post(`${this.apiurl}/prices/add`,{productid:data['id'],
        effdate:data['date'],
        saleprice:data['sale'],
        reason:data['reason'],
        comments:data['comments'],
        overridereason:data['overridereason'] || undefined});
    }    
    updatePrice(data:any){
        return this.http.put(`${this.apiurl}/prices/${data['price_id']}`,{productid:data['id'],
        effdate:data['date'],
        saleprice:data['sale'],
        reason:data['reason'],
        comments:data['comments']
    });
    }    
    
}
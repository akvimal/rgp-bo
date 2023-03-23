import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class StockService {

    apiurl = environment.apiHost;

    constructor(private http:HttpClient){ }

    findAll(){
        return this.http.get(`${this.apiurl}/stock`);
    }

    updatePrice(price:any){
        return this.http.post(`${this.apiurl}/products/price`,price);
    }
    
    updateQty(qtyForm:any){
        return this.http.post(`${this.apiurl}/products/qty`,{...qtyForm, status: 'APPROVED'});
    }
}
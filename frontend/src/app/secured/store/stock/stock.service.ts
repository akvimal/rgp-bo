import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class StockService {

    apiurl = environment.apiHost;

    constructor(private http:HttpClient){ }

    findAll(){
        return this.http.get(`${this.apiurl}/stock`);
    }

    filterByCriteria(criteria:any){   
        return this.http.post(`${this.apiurl}/stock/filter`, criteria);
    }

    findByItems(purchaseitemids:[]){
        return this.http.post(`${this.apiurl}/stock/items`, purchaseitemids);
    }

    findByProducts(ids:number[]){
        return this.http.post(`${this.apiurl}/stock/products`, ids);
    }

    findAllReadyForSale(){
        return this.http.get(`${this.apiurl}/stock/ready`);
    }

    findDemand(fromdate:string,todate:string,incother:boolean){
        const criteria = {begindt:fromdate,enddt:todate,orders_avail:incother};
        console.log('criteria: ',criteria);
        
        return this.http.post(`${this.apiurl}/stock/demand`, criteria);
    }

    findAllPriceAdjustments(){
        return this.http.get(`${this.apiurl}/stock/adjust/price`);
    }

    deleteQtyAdjustment(id:number){
        return this.http.delete(`${this.apiurl}/stock/adjust/qty/${id}`)
    }

    findAllQtyAdjustments(){
        return this.http.get(`${this.apiurl}/stock/adjust/qty`);
    }

    updatePrice(price:any){
        return this.http.post(`${this.apiurl}/stock/adjust/price`,price);
    }
    
    updateQty(qtyForm:any){
        return this.http.post(`${this.apiurl}/stock/adjust/qty`,{...qtyForm, status: 'APPROVED'});
    }   
        
    updateQtyToZero(obj:any){
        return this.http.post(`${this.apiurl}/stock/adjust/qty/bulk`,obj);
    }   
    
    adjustReturnQuantities(adjustments:any){
        return this.http.post(`${this.apiurl}/stock/adjust/returns`,adjustments);
    }
}
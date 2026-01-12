import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";
import { PurchaseOrder } from "./purchase-order.model";

@Injectable({
    providedIn: 'root'
})
export class PurchaseOrderService {

    apiurl = `${environment.apiHost}/purchaseorders`;

    constructor(private http:HttpClient){ }

    findAll(){
        return this.http.get(this.apiurl);
    }
    
    findAllByCriteria(criteria:any){
        return this.http.post(`${this.apiurl}/filter`,criteria);
    }

    findById(id:number){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    save(order:PurchaseOrder){
        return this.http.post(this.apiurl,{...order, id: null});
    }

    update(id:number, order:PurchaseOrder){
        return this.http.put(`${this.apiurl}/${id}`,order);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    download(id:number) {
        return this.http.post(`${environment.apiHost}/download/po`, {id}, {responseType: "blob"});
    }

    createFromIntents(payload: { vendorid: number; intentIds: number[]; comments?: string }) {
        return this.http.post(`${this.apiurl}/from-intents`, payload);
    }

    createWithItems(payload: any) {
        return this.http.post(`${this.apiurl}/with-items`, payload);
    }

    getSmartSuggestions(storeId: number) {
        return this.http.get<any>(`${this.apiurl}/suggestions?storeId=${storeId}`);
    }
}
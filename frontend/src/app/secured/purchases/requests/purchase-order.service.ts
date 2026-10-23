import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "src/environments/environment";
import { PurchaseOrder } from "./purchase-order.model";

@Injectable({
    providedIn: 'root'
})
export class PurchaseOrderService {

    apiurl = `${environment.apiHost}/purchaseorders`;

    /** an order was changed (submitted, edited, deleted, items added): the list beside it reloads */
    private changedSource = new Subject<void>();
    changed$ = this.changedSource.asObservable();

    constructor(private http:HttpClient){ }

    notifyChanged(){
        this.changedSource.next();
    }

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

    update(id:number, order:any){
        return this.http.put(`${this.apiurl}/${id}`,order);
    }

    submit(id:number){
        return this.http.post(`${this.apiurl}/${id}/submit`, {});
    }

    approve(id:number){
        return this.http.post(`${this.apiurl}/${id}/approve`, {});
    }

    reject(id:number, reason:string){
        return this.http.post(`${this.apiurl}/${id}/reject`, { reason });
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    download(id:number) {
        return this.http.post(`${environment.apiHost}/download/po`, {id}, {responseType: "blob"});
    }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({
    providedIn: 'root'
})
export class PurchaseIntentService {

    apiurl = `${environment.apiHost}/purchaserequests`;

    constructor(private http:HttpClient){ }

    findAll(){
        return this.http.get(this.apiurl);
    }

    findAllByCriteria(criteria:any){
        return this.http.post(`${this.apiurl}/filter`, criteria);
    }

    /** the vendor a product was last bought from, or null */
    lastVendor(productid:number){
        return this.http.get<any>(`${this.apiurl}/last-vendor/${productid}`);
    }

    findById(id:number){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    findSuggestions(params:any){
        return this.http.get(`${environment.apiHost}/purchase-suggestions`, { params });
    }

    createOrdersFromSuggestions(payload:any){
        return this.http.post(`${environment.apiHost}/purchase-suggestions/create-orders`, payload);
    }

    save(request:any){
        return this.http.post(this.apiurl,{...request, id: null});
    }

    /** several products asked for together: the fields are shared, `lines` is [{productid | requestedname, qty, note}] */
    saveSlip(slip:any){
        return this.http.post(`${this.apiurl}/slip`, slip);
    }

    /** more products for a slip that is already raised */
    addToSlip(groupid:number, lines:any[]){
        return this.http.post(`${this.apiurl}/slip/${groupid}/lines`, { lines });
    }

    update(id:number, request:any){
        return this.http.put(`${this.apiurl}/${id}`,request);
    }

    removeOrder(id:number){
        return this.http.put(`${this.apiurl}/${id}/remove`,{});
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "./../../../environments/environment";
import { SaleDelivery } from "./models/sale-delivery.model";

@Injectable({
    providedIn: 'root'
})
export class SaleDeliveryService {

    apiurl = `${environment.apiHost}/deliveries`;

    constructor(private http:HttpClient){}

    save(delivery:SaleDelivery){
        if(delivery.saleid){
            return this.http.put(`${this.apiurl}/${delivery.saleid}`,delivery);
        }

        return this.http.post(`${this.apiurl}`,delivery);
    }

    findAll(){
        return this.http.get(`${this.apiurl}`);
    }

    /** the entries already recorded that could be this delivery's cost (to link instead of paying again) */
    costCandidates(saleid:number){
        return this.http.get<any>(`${this.apiurl}/${saleid}/cost-candidates`);
    }

    /** deliveries whose cost is not linked to an expense, and the pairs that can be linked in one go */
    costSuggestions(){
        return this.http.get<any>(`${this.apiurl}/cost-links/suggestions`);
    }

    linkCosts(links:{ saleid:number; kind:string; entryid:number }[]){
        return this.http.post<any>(`${this.apiurl}/cost-links`, { links });
    }

    /** the people who work at a store, for "delivered by" */
    storeStaff(storeid:number){
        return this.http.get<any[]>(`${environment.apiHost}/store-cash/users`, { params: { storeid: String(storeid) } });
    }

    delete(id:number) {
        
    }

}

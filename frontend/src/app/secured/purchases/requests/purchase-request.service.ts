import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";
import { PurchaseRequest } from "./purchase-request.model";

@Injectable({
    providedIn: 'root'
})
export class PurchaseRequestService {

    apiurl = `${environment.apiHost}/purchaserequests`;

    constructor(private http:HttpClient){ }

    findAll(){
        return this.http.get(this.apiurl);
    }

    findAllByCriteria(criteria:any){
        return this.http.post(`${this.apiurl}/filter`, criteria);
    }

    findById(id:number){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    save(request:PurchaseRequest){
        return this.http.post(this.apiurl,{...request, id: null});
    }

    update(id:number, request:PurchaseRequest){
        return this.http.put(`${this.apiurl}/${id}`,request);
    }

    removeOrder(id:number){
        return this.http.put(`${this.apiurl}/${id}/remove`,{});
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }
}
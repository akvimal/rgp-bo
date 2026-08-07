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

    delete(id:number) {
        
    }

}

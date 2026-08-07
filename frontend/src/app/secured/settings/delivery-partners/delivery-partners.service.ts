import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";
import { DeliveryPartner } from "./delivery-partner.model";

@Injectable({
    providedIn: 'root'
})
export class DeliveryPartnersService {
    apiurl = `${environment.apiHost}/delivery-partners`;

    constructor(private http: HttpClient) {}

    findAll() {
        return this.http.get(this.apiurl);
    }

    findById(id: any) {
        return this.http.get(`${this.apiurl}/${id}`);
    }

    save(partner: DeliveryPartner) {
        return this.http.post(this.apiurl, partner);
    }

    update(id: number, partner: DeliveryPartner) {
        return this.http.put(`${this.apiurl}/${id}`, partner);
    }

    remove(id: number) {
        return this.http.delete(`${this.apiurl}/${id}`);
    }
}

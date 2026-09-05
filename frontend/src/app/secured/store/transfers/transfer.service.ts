import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class TransferService {

    apiurl = `${environment.apiHost}/store-stock-transfers`;

    constructor(private http: HttpClient) {}

    findAll(criteria: any) {
        return this.http.get(this.apiurl, { params: criteria });
    }

    available(itemid: number, storeid: number) {
        return this.http.get(`${this.apiurl}/available`, { params: { itemid: String(itemid), storeid: String(storeid) } });
    }

    dispatch(payload: any) {
        return this.http.post(this.apiurl, payload);
    }

    receive(id: number, receivedqty?: number) {
        return this.http.put(`${this.apiurl}/${id}/receive`, { receivedqty });
    }

    cancel(id: number) {
        return this.http.put(`${this.apiurl}/${id}/cancel`, {});
    }
}

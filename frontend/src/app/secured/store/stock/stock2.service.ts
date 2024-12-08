import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class Stock2Service {

    apiurl = environment.apiHost+'/stock2';

    constructor(private http:HttpClient){ }

    findAll(criteria:any){
        return this.http.post(this.apiurl, criteria);
    }

    findByProduct(id:number){
        return this.http.get(`${this.apiurl}/${id}`);
    }
}
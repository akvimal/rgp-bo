import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class StockService {

    apiurl = 'http://localhost:3000';

    constructor(private http:HttpClient){ }

    findAll(){
        return this.http.get(`${this.apiurl}/stock`);
    }

    updatePrice(price:any){
        return this.http.post(`${this.apiurl}/products/price`,price);
    }
}
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Vendor } from "./vendor.model";

@Injectable({
    providedIn: 'root'
})
export class VendorsService {

    apiurl = 'http://localhost:3000/vendors';

    constructor(private http:HttpClient){}

    findAll(){
        return this.http.get(this.apiurl);
    }

    findById(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    save(vendor:Vendor){
        return this.http.post(`${this.apiurl}`,vendor);
    }

    update(id:number, vendor:Vendor){
        return this.http.put(`${this.apiurl}/${id}`,vendor);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }
}
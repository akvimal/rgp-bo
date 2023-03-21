import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Customer } from "./customer.model";
import { environment } from "./../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class CustomersService {

    apiurl = `${environment.apiHost}/customers`;

    constructor(private http:HttpClient){}

    save(customer:Customer){
        return this.http.post(`${this.apiurl}`,customer);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    find(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    findAllApi(){
        return this.http.get(`${this.apiurl}`);
    }
    
    findAll(){
        return this.http.get(`${this.apiurl}`);
    }

    getSaleData(criteria:any){
        return this.http.post(`${this.apiurl}/sale`,criteria);
    }   
}
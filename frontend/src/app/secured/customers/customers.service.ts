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

    findByCriteria(criteria:any){
        return this.http.post(`${this.apiurl}/filter`,{...criteria, limit:50});
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

    // getSaleData(criteria:any){
    //     return this.http.post(`${this.apiurl}/sale`,criteria);
    // }   

    getCustomerOrdersByPeriod(cust:any,year:number,month:number){
        return this.http.get(`${this.apiurl}/${cust['id']}/${year}/${month}/orders`);
    }

    getCustomerOrderedMonths(cust:any){
        return this.http.get(`${this.apiurl}/${cust.id}/periods`);
    }

    findAllDocuments(customerId:number){
        return this.http.get(`${this.apiurl}/${customerId}/documents`);
    }

    addDocument(customerDocument:any){
        return this.http.post(`${this.apiurl}/documents/add`,customerDocument);
    }

    removeDocuments(customerId:number,ids:number[]){
        return this.http.post(`${this.apiurl}/documents/remove`,{customerId,ids});
    }

}
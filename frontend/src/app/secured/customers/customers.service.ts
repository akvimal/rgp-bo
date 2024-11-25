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

    getSaleData(criteria:any){
        return this.http.post(`${this.apiurl}/sale`,criteria);
    }   

    getCustomerOrdersByPeriod(cust:any,year:number,month:number){
        console.log('cust: ',cust);
        
        return this.http.get(`${this.apiurl}/${cust['id']}/${year}/${month}/orders`);
    }

    getCustomerOrderedMonths(cust:any){
        return this.http.get(`${this.apiurl}/${cust.id}/periods`);
    }

    findAllDocuments(customerId:number){
        console.log('getting documents fr customer',customerId);
        
        return this.http.get(`${this.apiurl}/${customerId}/documents`);
    }

    addDocument(customerId:number,documentId:number){
        return this.http.post(`${this.apiurl}/documents/add`,{customerId,documentId});
    }

    removeDocuments(customerId:number,documentId:number){
        return this.http.post(`${this.apiurl}/documents/remove`,{customerId,documentId});
    }

}
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { InvoiceItem } from "./invoice-item.model";
import { Invoice } from "./invoice.model";
import { environment } from "./../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class InvoiceService {

    apiurl = environment.apiHost;

    constructor(private http:HttpClient){}

    find(id:any){
        return this.http.get(`${this.apiurl}/purchases/${id}`);
    }

    findAll(){
        return this.http.get(`${this.apiurl}/purchases`);
    }

    save(invoice:Invoice){
        return this.http.post(`${this.apiurl}/purchases`,invoice);
    }

    update(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchases`,{ids,values});
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/purchases/${id}`);//
    }

    //////
    
    findItem(id:any){
        return this.http.get(`${this.apiurl}/purchaseitems/${id}`);
    }

    saveItem(item:InvoiceItem){
        return this.http.post(`${this.apiurl}/purchaseitems`,item);
    }

    // findAllItemsApi(criteria:any){
    //     return this.http.get(`${this.apiurl}/purchaseitems`,{params:criteria});
    // }

    updateItems(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchaseitems`,{ids,values});
    }

    removeItems(ids:any){
        return this.http.delete(`${this.apiurl}/purchaseitems`,{body:ids});
    }

}
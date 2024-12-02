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

    confirm(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchases/confirm`,{ids,values});
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

    findItemsByProduct(productid:any){
        return this.http.get(`${this.apiurl}/purchaseitems/product/${productid}`);
    }

    findItemSalePrice(productid:any,batch:any){
        return this.http.post(`${this.apiurl}/purchaseitems/saleprice`,{productid,batch});
    }

    saveItem(item:InvoiceItem){
        console.log('item to be saved:',item);
        
        const obj:any ={}
        for (const [key, value] of Object.entries(item)) {
            if(value !== ''){
                obj[key] = value
            }
          }
        return this.http.post(`${this.apiurl}/purchaseitems`,obj);
    }

    updateItems(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchaseitems`,{ids,values});
    }

    removeItems(ids:any){
        return this.http.delete(`${this.apiurl}/purchaseitems`,{body:ids});
    }

    
}
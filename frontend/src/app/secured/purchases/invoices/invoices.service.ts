import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { InvoiceItem } from "./invoice-item.model";
import { Invoice } from "./invoice.model";
import { VendorPayment } from "./vendor-payment.model";
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

    findAll(page = 1, limit = 50){
        return this.http.get<{ data: any[]; total: number; page: number; limit: number }>(
            `${this.apiurl}/purchases`, { params: { page: String(page), limit: String(limit) } });
    }

    findOutstanding(params?:any){
        return this.http.get(`${this.apiurl}/purchases/outstanding`, { params });
    }

    findPayables(){
        return this.http.get(`${this.apiurl}/purchases/payables`);
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

    findPayments(invoiceid:any){
        return this.http.get(`${this.apiurl}/vendorpayments/invoice/${invoiceid}`);
    }

    savePayment(payment:VendorPayment){
        return this.http.post(`${this.apiurl}/vendorpayments`, payment);
    }

    payRun(payload:any){
        return this.http.post(`${this.apiurl}/vendorpayments/batch`, payload);
    }

    updatePayment(id:number, payment:VendorPayment){
        return this.http.put(`${this.apiurl}/vendorpayments/${id}`, payment);
    }

    reversePayment(id:number, reason?:string){
        return this.http.post(`${this.apiurl}/vendorpayments/${id}/reverse`, { reason });
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

    importOrderItems(invoiceid:any){
        return this.http.post(`${this.apiurl}/purchaseitems/import-order/${invoiceid}`, {});
    }

    updateItems(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchaseitems`,{ids,values});
    }

    removeItems(ids:any){
        return this.http.delete(`${this.apiurl}/purchaseitems`,{body:ids});
    }

    
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { SaleItem } from "./models/sale-item.model";
import { Sale } from "./models/sale.model";
import { environment } from "./../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class SaleService {

    saved = new BehaviorSubject<[]>([]);
    items = new BehaviorSubject<SaleItem[]>([]);
    totalState = new BehaviorSubject(0);

    apiurl = `${environment.apiHost}/sales`;

    constructor(private http:HttpClient){}

    save(sale:Sale){
        console.log(sale);
        
        return sale.billno ? this.http.put(`${this.apiurl}`,sale) : this.http.post(`${this.apiurl}`,sale);
    }

    saveReturns(returns:any){
        return this.http.post(`${this.apiurl}/returns`,returns);
    }

    findAllItems(criteria:any){
        console.log(criteria);
        return this.http.post(`${this.apiurl}/items/criteria`,criteria);
    }
     
    findEligibleReturnItems(saleid:any){
        return this.http.get(`${this.apiurl}/returns/${saleid}/eligible`);
    }

    findReturnItemToAdjust(returnItemId:any){
        return this.http.get(`${this.apiurl}/returns/items/${returnItemId}`);
    }
     
    findItemsWithAvailableQty(saleid:number){
         return this.http.get(`${this.apiurl}/${saleid}/availableitems`);
    }
 
    saveItem(item:SaleItem){
        return this.http.post(`${this.apiurl}/items`,item);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    getCustomerMonthlySales(custid:number,year:number,month:number){
        return this.http.get(`${this.apiurl}/${custid}/${year}/${month}/customer`);
    }

    getSalesMonthByCustomer(custid:number){
        return this.http.get(`${this.apiurl}/${custid}/customer/months`);
    }

    find(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    refreshSavedSales(){
        this.http.get(`${this.apiurl}/saved`).subscribe((data:any) => {
            this.saved.next(data);
        });
    }

    findAll(criteria:any){
        return this.http.get(`${this.apiurl}`,{params:criteria});
    }

    findAllReturns(criteria:any){
        return this.http.get(`${this.apiurl}/returns`);
    }

    removeItem(id:number){
        const arr = this.items.value;
        const mat = arr.find(i => i.id === id);
        const non = arr.filter(i => i.id !== id);
        this.items.next([...non]);
        this.updateTotal((mat?.total||0),0);
    }

    removeReturnItem(id:number){
        return this.http.delete(`${this.apiurl}/returns/${id}`);
    }

    updateTotal(prev:number,now:number){
        this.totalState.next(this.totalState.value - prev + now)
    }

    getSaleData(criteria:any){
        return this.http.post(`${this.apiurl}/data`,criteria);
    }

    getCustomerData(criteria:any){
        return this.http.post(`${this.apiurl}/visits`,criteria);
    }   
     
    download(criteria:any){
        return this.http.post(`${environment.apiHost}/download/salereport`, criteria, {responseType: "blob"});
    }

}
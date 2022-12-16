import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { SaleItem } from "./sale-item.model";
import { Sale } from "./sale.model";

@Injectable({
    providedIn: 'root'
})
export class SaleService {

    items = new BehaviorSubject<SaleItem[]>([]);
    totalState = new BehaviorSubject(0);

    apiurl = 'http://localhost:3000/sales';

    constructor(private http:HttpClient){}

    save(sale:Sale){
        return this.http.post(`${this.apiurl}`,sale);
    }

    findAllItems(criteria:any){
        return this.http.post(`${this.apiurl}/items/criteria`,criteria);
     }
 
    saveItem(item:SaleItem){
        return this.http.post(`${this.apiurl}/items`,item);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    getSalesByCustomer(custid:number){
        return this.http.get(`${this.apiurl}/${custid}/customer`);
    }

    find(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    findAll(criteria:any){
       return this.http.get(`${this.apiurl}`,{params:criteria});
    }

    removeItem(id:number){
        const arr = this.items.value;
        const mat = arr.find(i => i.id === id);
        const non = arr.filter(i => i.id !== id);
        this.items.next([...non]);
        this.updateTotal((mat?.total||0),0);
    }

    updateTotal(prev:number,now:number){
        this.totalState.next(this.totalState.value - prev + now)
    }

    
}
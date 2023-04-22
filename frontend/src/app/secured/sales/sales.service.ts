import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { SaleItem } from "./sale-item.model";
import { Sale } from "./sale.model";
import { environment } from "./../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class SaleService {

    items = new BehaviorSubject<SaleItem[]>([]);
    totalState = new BehaviorSubject(0);

    apiurl = `${environment.apiHost}/sales`;

    constructor(private http:HttpClient){}

    save(sale:Sale){
        sale.items?.forEach((i:any) => {
            i.qty = (i.box * i.pack) + i.boxbal;
        });
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

    getSaleData(criteria:any){
        return this.http.post(`${this.apiurl}/data`,criteria);
    }   
    getCustomerData(criteria:any){
        return this.http.post(`${this.apiurl}/visits`,criteria);
    }   
     
    downloadh1(criteria:any){
        return this.http.post(`${environment.apiHost}/download/h1schedule`, criteria, {responseType: "blob"});
    }

    getProps() {
        return this.http.get("/assets/props.json")
    }
}
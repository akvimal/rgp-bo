import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class Stock2Service {

    products = new Subject();
    stats = new Subject();

    filter:any;

    apiurl = environment.apiHost+'/stock2';

    constructor(private http:HttpClient){ }

    getProducts(){
        return this.products;
    }
    getProductStats(){
        return this.stats;
    }

    refreshProducts(){
        this.findAll(this.filter);
    }

    findAll(criteria:any){
        this.filter = criteria;
        this.http.post(this.apiurl, this.filter).subscribe(data => {
            this.products.next(data);
        })
    }

    findByProduct(id:number){
        this.http.get(`${this.apiurl}/${id}`).subscribe(data => {
            this.stats.next(data);
        })
    }
}
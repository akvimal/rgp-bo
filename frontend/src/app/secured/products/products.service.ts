import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Product } from "./product.model";
import { environment } from "./../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class ProductsService {

    apiurl = `${environment.apiHost}/products`;

    constructor(private http:HttpClient){}

    findAll(criteria:any){
        return this.http.get(this.apiurl,{params:criteria});
    }

    findById(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }    
    search(text:any){
        return this.http.get(`${this.apiurl}/search=${text}`);
    }

    save(product:Product){
        return this.http.post(`${this.apiurl}`,product);
    }

    update(id:number, product:Product){
        return this.http.put(`${this.apiurl}/${id}`,product);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }
}
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Product } from "./product.model";
import { environment } from "./../../../environments/environment";
import { ProductPrice } from "./product-price";

@Injectable({
    providedIn: 'root'
})
export class ProductsService {

    apiurl = `${environment.apiHost}/products`;

    constructor(private http:HttpClient){}

    findAll(criteria:any){
        return this.http.get(this.apiurl,{params:criteria});
    }

    findAllPrices(){
        return this.http.get(`${this.apiurl}/prices`);
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

    addPrice(data:ProductPrice){
        return this.http.post(`${this.apiurl}/prices`,{productid:data['id'],
        marketprice:data['market_price'],
        saleprice:data['our_sale_price']});
    }    
    updatePrice(data:ProductPrice){
        return this.http.put(`${this.apiurl}/prices/${data['price_id']}`,{productid:data['id'],
        marketprice:data['market_price'],
        saleprice:data['our_sale_price']});
    }    
    
}
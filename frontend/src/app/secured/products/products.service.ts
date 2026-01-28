import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Product } from "./product.model";
import { environment } from "./../../../environments/environment";
import { ProductPrice } from "./product-price.model";

@Injectable({
    providedIn: 'root'
})
export class ProductsService {

    apiurl = `${environment.apiHost}/products`;

    constructor(private http:HttpClient){}

    findAll(criteria:any){
        // Use GET endpoint to retrieve all active products
        return this.http.get(this.apiurl);
    }

    findByCriteria(criteria:any){
        return this.http.post(`${this.apiurl}/filter`, criteria);
    }

    findByCriteria2(criteria:any){
        return this.http.post(`${this.apiurl}/filter2`, criteria);
    }

    getCategories(){
        return this.http.get<string[]>(`${this.apiurl}/categories`);
    }

    getDashboardMetrics(){
        return this.http.get<any>(`${this.apiurl}/dashboard/metrics`);
    }

    findAllPrices(criteria:any){
        return this.http.post(`${this.apiurl}/prices`,criteria);
    }

    findById(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }    
    findPricesById(prodid:any){
        return this.http.get(`${this.apiurl}/prices/${prodid}`);
    }    
    search(text:any){
        return this.http.get(`${this.apiurl}?search=${text}`);
    }

    save(product:Product){
        return this.http.post(`${this.apiurl}`,product);
    }

    update(id:number, props:any){
        return this.http.put(`${this.apiurl}/${id}`,props);
    }
    
    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    addPrice(data:any){
        return this.http.post(`${this.apiurl}/prices/add`,{productid:data['id'],
        effdate:data['date'],
        saleprice:data['sale'],
        reason:data['reason'],
        comments:data['comments']});
    }    
    updatePrice(data:any){
        return this.http.put(`${this.apiurl}/prices/${data['price_id']}`,{productid:data['id'],
        effdate:data['date'],
        saleprice:data['sale'],
        reason:data['reason'],
        comments:data['comments']
    });
    }    
    
}
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class StockService {

    products = new Subject();
    stats = new Subject();

    filter:any;

    stock2url = environment.apiHost+'/stock2';
    apiurl = environment.apiHost;

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

    getMonthAvailableList(){
        return this.http.get(this.stock2url+'/expiries/all');
    }
    getProductsByExpiryMonths(month:string){
        return this.http.get(this.stock2url+'/expiries/month/'+month);
    }
    getNearExpiryCount(){
        return this.http.get(this.stock2url+'/expiries/near-count');
    }


    findAll(criteria:any){
        this.filter = criteria;
        this.http.post(this.stock2url, this.filter).subscribe(data => {
            this.products.next(data);
        })
    }

    findByProduct(id:number){
        this.http.get(`${this.stock2url}/${id}`).subscribe(data => {
            this.stats.next(data);
        })
    }

    filterByCriteria(criteria:any){   
        return this.http.post(`${this.apiurl}/stock/filter`, criteria);
    }

    findByItems(purchaseitemids:[]){
        return this.http.post(`${this.apiurl}/stock/items`, purchaseitemids);
    }

    findByProducts(ids:number[]){
        return this.http.post(`${this.apiurl}/stock/products`, ids);
    }

    findAllReadyForSale(){
        return this.http.get(`${this.apiurl}/stock/ready`);
    }

    findDemand(fromdate:string,todate:string,incother:boolean){
        const criteria = {begindt:fromdate,enddt:todate,orders_avail:incother};
        console.log('criteria: ',criteria);
        
        return this.http.post(`${this.apiurl}/stock/demand`, criteria);
    }

    findAllPriceAdjustments(){
        return this.http.get(`${this.apiurl}/stock/adjust/price`);
    }

    deleteQtyAdjustment(id:number){
        return this.http.delete(`${this.apiurl}/stock/adjust/qty/${id}`)
    }

    findAllQtyAdjustments(){
        return this.http.get(`${this.apiurl}/stock/adjust/qty`);
    }

    updatePrice(price:any){
        return this.http.post(`${this.apiurl}/stock/adjust/price`,price);
    }
    
    updateQty(qtyForm:any){
        // no explicit status: the backend decides APPROVED vs PENDING from the value threshold (WS-3).
        return this.http.post(`${this.apiurl}/stock/adjust/qty`, qtyForm);
    }

    updateQtyAdjustment(id:number, payload:any){
        return this.http.put(`${this.apiurl}/stock/adjust/qty/${id}`, payload);
    }

    findPendingAdjustments(){
        return this.http.get(`${this.apiurl}/stock/audit`);
    }

    approveAdjustment(id:number){
        return this.http.put(`${this.apiurl}/stock/audit/${id}/approve`, {});
    }

    rejectAdjustment(id:number){
        return this.http.put(`${this.apiurl}/stock/audit/${id}/reject`, {});
    }

    startCount(category?:string, storeid?:number|null){
        return this.http.post(`${this.apiurl}/stock/counts`, { category: category || null, storeid: storeid || null });
    }

    findCounts(){
        return this.http.get(`${this.apiurl}/stock/counts`);
    }

    findCountDetail(id:number){
        return this.http.get(`${this.apiurl}/stock/counts/${id}`);
    }

    submitCount(id:number, items:any[]){
        return this.http.post(`${this.apiurl}/stock/counts/${id}/submit`, { items });
    }

    updateQtyToZero(obj:any){
        return this.http.post(`${this.apiurl}/stock/adjust/qty/bulk`,obj);
    }   
    
    adjustReturnQuantities(adjustments:any){
        return this.http.post(`${this.apiurl}/stock/adjust/returns`,adjustments);
    }
}
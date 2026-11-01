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

    /** a draft adjustment is deleted with the reason, which is recorded */
    deleteQtyAdjustment(id:number, note:string){
        return this.http.delete(`${this.apiurl}/stock/adjust/qty/${id}`, { body: { note } })
    }

    /** the adjustments, or only those of one audit */
    findAllQtyAdjustments(audit?:number|null){
        return this.http.get(`${this.apiurl}/stock/adjust/qty`, { params: audit ? { audit: String(audit) } : {} });
    }

    /** the audits an adjustment can be made for: counting now, or counted and not yet signed off */
    auditsForAdjust(){
        return this.http.get<any[]>(`${this.apiurl}/stock-audits`, { params: { status: 'ALL' } });
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

    /** a count difference is approved with the reason it arose (reasoncode, and a note for Other) */
    approveAdjustment(id:number, payload:any = {}){
        return this.http.put(`${this.apiurl}/stock/audit/${id}/approve`, payload);
    }

    openCountItems(storeid?:number|null){
        return this.http.get<any>(`${this.apiurl}/stock/counts/open-items`, { params: storeid ? { storeid: String(storeid) } : {} });
    }

    recountAdjustment(id:number, qty:number){
        return this.http.put(`${this.apiurl}/stock/audit/${id}/recount`, { qty });
    }

    /** rejecting needs the reason, which is kept */
    rejectAdjustment(id:number, note:string){
        return this.http.put(`${this.apiurl}/stock/audit/${id}/reject`, { note });
    }

    startCount(category?:string, storeid?:number|null, auditid?:number|null){
        return this.http.post(`${this.apiurl}/stock/counts`, { category: category || null, storeid: storeid || null, auditid: auditid || undefined });
    }

    findCounts(){
        return this.http.get(`${this.apiurl}/stock/counts`);
    }

    findCountDetail(id:number){
        return this.http.get(`${this.apiurl}/stock/counts/${id}`);
    }

    submitCount(id:number, items:any[], finishedat?:string){
        return this.http.post(`${this.apiurl}/stock/counts/${id}/submit`, { items, finishedat });
    }

    updateQtyToZero(obj:any){
        return this.http.post(`${this.apiurl}/stock/adjust/qty/bulk`,obj);
    }   
    
    adjustReturnQuantities(adjustments:any){
        return this.http.post(`${this.apiurl}/stock/adjust/returns`,adjustments);
    }
}
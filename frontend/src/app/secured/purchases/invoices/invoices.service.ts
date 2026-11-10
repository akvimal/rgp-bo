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

    priceImpact(id:any){
        return this.http.get<any>(`${this.apiurl}/pricing/invoice/${id}/impact`);
    }

    newPrices(id:any){
        return this.http.get<any>(`${this.apiurl}/pricing/invoice/${id}/new-prices`);
    }

    priceNew(id:any, prices?:any){
        return this.http.post<any>(`${this.apiurl}/pricing/invoice/${id}/price-new`, { prices });
    }

    priceCheck(id:any){
        return this.http.get<any>(`${this.apiurl}/purchases/${id}/price-check`);
    }

    findAll(page = 1, limit = 50, vendorId?: number | null){
        const params: any = { page: String(page), limit: String(limit) };
        if (vendorId) params.vendor = String(vendorId);
        return this.http.get<{ data: any[]; total: number; page: number; limit: number }>(`${this.apiurl}/purchases`, { params });
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

    /** the invoice list: view, vendor / date / invoice-no filters, sort and paging are query params */
    search(params:any){
        return this.http.get(`${this.apiurl}/purchases/search`, { params });
    }

    /** totals for the chips above the list (same filters, not the view) */
    /** the vendors that have invoices in the date window (for the list's vendor filter) */
    vendorsIn(params:any){
        return this.http.get<any[]>(`${this.apiurl}/purchases/vendors`, { params });
    }

    summary(params:any){
        return this.http.get<any>(`${this.apiurl}/purchases/summary`, { params });
    }

    /** payments of one invoice with who recorded each */
    paymentsOf(invoiceid:number){
        return this.http.get<any[]>(`${this.apiurl}/purchases/${invoiceid}/payments`);
    }

    hold(invoiceid:number, reason:string){
        return this.http.post(`${this.apiurl}/purchases/${invoiceid}/hold`, { reason });
    }

    /** approval for payment: the rule (and whether this person may approve), approve, withdraw */
    approvalSettings(){
        return this.http.get<any>(`${this.apiurl}/purchases/approval-settings`);
    }

    setApprovalSettings(body:{enabled:boolean, limit:number}){
        return this.http.put<any>(`${this.apiurl}/purchases/approval-settings`, body);
    }

    approve(invoiceid:number, note?:string){
        return this.http.post(`${this.apiurl}/purchases/${invoiceid}/approve`, { note });
    }

    unapprove(invoiceid:number){
        return this.http.post(`${this.apiurl}/purchases/${invoiceid}/unapprove`, {});
    }

    release(invoiceid:number){
        return this.http.post(`${this.apiurl}/purchases/${invoiceid}/release`, {});
    }

    /** correct reference / mode / date / remarks of a recorded payment (never the amount) */
    updatePaymentInfo(id:number, body:any){
        return this.http.put(`${this.apiurl}/vendorpayments/${id}`, body);
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

    /** reads an uploaded invoice copy (PDF text or OCR of a photo); nothing is saved */
    // ---- the lines read from a scanned copy, saved with the draft and checked one at a time
    scan(id:any){ return this.http.get<any>(`${this.apiurl}/purchases/${id}/scan`); }
    saveScan(id:any, body:any){ return this.http.put<any>(`${this.apiurl}/purchases/${id}/scan`, body); }
    saveScanLine(id:any, lineId:any, body:any){ return this.http.put<any>(`${this.apiurl}/purchases/${id}/scan/lines/${lineId}`, body); }
    verifyScanLine(id:any, lineId:any){ return this.http.post<any>(`${this.apiurl}/purchases/${id}/scan/lines/${lineId}/verify`, {}); }
    unverifyScanLine(id:any, lineId:any){ return this.http.post<any>(`${this.apiurl}/purchases/${id}/scan/lines/${lineId}/unverify`, {}); }
    discardScanLine(id:any, lineId:any, reason:string){ return this.http.post<any>(`${this.apiurl}/purchases/${id}/scan/lines/${lineId}/discard`, { reason }); }
    restoreScanLine(id:any, lineId:any){ return this.http.post<any>(`${this.apiurl}/purchases/${id}/scan/lines/${lineId}/restore`, {}); }
    verifyAllScan(id:any){ return this.http.post<any>(`${this.apiurl}/purchases/${id}/scan/verify-all`, {}); }

    /** `ai`: the person asks for the assistant to read the copy, whatever the plain reading made of it */
    extract(path:string, ai = false){
        return this.http.post<any>(`${this.apiurl}/purchases/extract`, ai ? { path, ai: true } : { path });
    }

    importOrderItems(invoiceid:any){
        return this.http.post(`${this.apiurl}/purchaseitems/import-order/${invoiceid}`, {});
    }

    updateItems(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchaseitems`,{ids,values});
    }

    /** the tax rates a purchase line offers (the business's own list, else the usual ones of its type of business) */
    taxRates(){
        return this.http.get<{rates:number[]}>(`${this.apiurl}/purchaseitems/tax-rates`);
    }

    /** what a line being typed means before it is added: new product, best margin, suggested price, MRP far above the rate */
    lineCheck(line:any){
        return this.http.post<any>(`${this.apiurl}/pricing/line-check`, line);
    }

    /** lines the vendor must clarify leave the invoice total until accepted or rejected */
    dispute(ids:number[], note:string){
        return this.http.post<any>(`${this.apiurl}/purchaseitems/dispute`, { ids, note });
    }

    resolveDispute(ids:number[], action:'ACCEPT'|'REJECT', note?:string){
        return this.http.post<any>(`${this.apiurl}/purchaseitems/resolve`, { ids, action, note });
    }

    removeItems(ids:any){
        return this.http.delete(`${this.apiurl}/purchaseitems`,{body:ids});
    }

    
}

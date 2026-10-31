import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Customer } from "./customer.model";
import { environment } from "./../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class CustomersService {

    apiurl = `${environment.apiHost}/customers`;
    relurl = `${environment.apiHost}/customer-relations`;

    constructor(private http:HttpClient){}

    save(customer:Customer){
        return this.http.post(`${this.apiurl}`,customer);
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/${id}`);
    }

    findByCriteria(criteria:any){
        return this.http.post(`${this.apiurl}/filter`,{...criteria, limit:50});
    }

    find(id:any){
        return this.http.get(`${this.apiurl}/${id}`);
    }

    findByMobile(mobile:any){
        return this.http.get(`${this.apiurl}/search/mobile/${mobile}`);
    }

    byMobile(mobile:any){
        return this.http.get<any[]>(`${this.apiurl}/by-mobile/${encodeURIComponent(mobile)}`);
    }

    duplicates(){
        return this.http.get<any[]>(`${this.apiurl}/duplicates`);
    }

    merge(keepid:number, mergeids:number[]){
        return this.http.post<any>(`${this.apiurl}/merge`, { keepid, mergeids });
    }

    findAllApi(){
        return this.http.get(`${this.apiurl}`);
    }
    
    findAll(){
        return this.http.get(`${this.apiurl}`);
    }

    getCustomerOrdersByPeriod(cust:any,year:number,month:number){
        return this.http.get(`${this.apiurl}/${cust['id']}/${year}/${month}/orders`);
    }

    getCustomerOrderedMonths(cust:any){
        return this.http.get(`${this.apiurl}/${cust.id}/periods`);
    }

    findAllDocuments(customerId:number){
        return this.http.get(`${this.apiurl}/${customerId}/documents`);
    }

    addDocument(customerDocument:any){
        return this.http.post(`${this.apiurl}/documents/add`,customerDocument);
    }

    removeDocuments(customerId:number,ids:number[]){
        return this.http.post(`${this.apiurl}/documents/remove`,{customerId,ids});
    }

    // ---- relationships: segments, audiences, the daily worklist, the contact log
    relSummary(){
        return this.http.get<any>(`${this.relurl}/summary`);
    }

    relSettings(){
        return this.http.get<any>(`${this.relurl}/settings`);
    }

    saveRelSettings(body:{activeDays?:number, contactCapDays?:number}){
        return this.http.put<any>(`${this.relurl}/settings`, body);
    }

    audiences(){
        return this.http.get<any>(`${this.relurl}/audiences`);
    }

    audience(body:any){
        return this.http.post<any>(`${this.relurl}/audience`, body);
    }

    worklist(){
        return this.http.get<any>(`${this.relurl}/worklist`);
    }

    profile(id:number){
        return this.http.get<any>(`${this.relurl}/${id}/profile`);
    }

    contacts(id:number){
        return this.http.get<any[]>(`${this.relurl}/${id}/contacts`);
    }

    recordContact(id:number, body:{channel:string, outcome:string, audience?:string, note?:string}){
        return this.http.post<any>(`${this.relurl}/${id}/contacts`, body);
    }

    setConsent(id:number, body:{consent?:string|null, doNotContact?:boolean, preferredChannel?:string|null, reviewOptOut?:boolean}){
        return this.http.put<any>(`${this.relurl}/${id}/consent`, body);
    }

    // ---- privacy: contact details are masked unless the login may read them all
    privacy(){
        return this.http.get<any>(`${this.apiurl}/privacy`);
    }

    /** ids of customers matching a name, place or number (the list holds only masked numbers for some logins) */
    lookup(q:string){
        return this.http.get<{ids:number[]}>(`${this.apiurl}/lookup`, { params: { q } });
    }

    /** the customer's real contact details; kept in the reveal log */
    reveal(id:number){
        return this.http.post<any>(`${this.apiurl}/${id}/reveal`, {});
    }

    reveals(days = 7){
        return this.http.get<any[]>(`${this.apiurl}/reveals`, { params: { days: String(days) } });
    }

    /** the audience as a CSV to download (the Business Head, or a role granted customers "export"); kept with who took it */
    exportAudience(body:any){
        return this.http.post<{ filename:string, csv:string, count:number }>(`${this.relurl}/audience/export`, body);
    }

    /** a customer screen reports a print attempt */
    logEvent(kind:string, page:string, blocked:boolean){
        return this.http.post<any>(`${this.apiurl}/events`, { kind, page, blocked });
    }

    // ---- Google review invitations and a customer's care record
    reviewInvite(saleId:number){
        return this.http.get<any>(`${this.relurl}/review-invite/${saleId}`);
    }

    recordReviewInvite(saleId:number){
        return this.http.post<any>(`${this.relurl}/review-invite`, { saleid: saleId });
    }

    care(id:number){
        return this.http.get<any>(`${this.relurl}/${id}/care`);
    }

    /** postpone a customer on "Contact today" until tomorrow, with the reason */
    snooze(id:number, body:{reason:string, note?:string}){
        return this.http.post<any>(`${this.relurl}/${id}/snooze`, body);
    }

    unsnooze(id:number){
        return this.http.post<any>(`${this.relurl}/${id}/unsnooze`, {});
    }

}

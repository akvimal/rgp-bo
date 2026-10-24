import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";
import { Observable } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class CashService {

    apiurl = environment.apiHost;

    constructor(private http:HttpClient){ }

    getStores(): Observable<any> {
        return this.http.get(`${this.apiurl}/stores`);
    }

    getBusinesses(): Observable<any> {
        return this.http.get(`${this.apiurl}/stores/businesses`);
    }

    createStore(body:any): Observable<any> {
        return this.http.post(`${this.apiurl}/stores`, body);
    }

    getStoreLicenses(id:any): Observable<any> {
        return this.http.get(`${this.apiurl}/stores/${id}/licenses`);
    }

    saveStoreLicenses(id:any, body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/stores/${id}/licenses`, body);
    }

    updateStore(id:any, body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/stores/${id}`, body);
    }

    deleteStore(id:any): Observable<any> {
        return this.http.delete(`${this.apiurl}/stores/${id}`);
    }

    getUsers(storeid?:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/users`, storeid ? { params: { storeid: String(storeid) } } : {});
    }

    getDashboard(storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/dashboard`, { params: { storeid: storeid || '' } });
    }

    getTemplates(storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/templates`, { params: { storeid: storeid || '' } });
    }

    saveTemplate(body:any): Observable<any> {
        return this.http.post(`${this.apiurl}/store-cash/templates`, body);
    }

    updateTemplate(id:any, body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/store-cash/templates/${id}`, body);
    }

    /** the checklists in force for a store (its own, the business's, or the standard) */
    getChecklists(storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/checklists`, { params: { storeid: storeid || '' } });
    }

    /** the editor's view: each list at the business's level, or one store's */
    getChecklistConfig(scope:string, storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/checklists/config`, { params: { scope, storeid: storeid || '' } });
    }

    /** what the last 30 days suggest for the checklists (the assistant words them when it is on) */
    getChecklistSuggestions(scope:string, storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/checklists/suggestions`, { params: { scope, storeid: storeid || '' } });
    }

    /** items for a situation the owner describes */
    draftChecklist(body:any): Observable<any> {
        return this.http.post(`${this.apiurl}/store-cash/checklists/draft`, body);
    }

    saveChecklist(body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/store-cash/checklists`, body);
    }

    resetChecklist(scope:string, storeid:any, kind:string): Observable<any> {
        return this.http.delete(`${this.apiurl}/store-cash/checklists`, { params: { scope, storeid: storeid || '', kind } });
    }

    getShifts(storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/shifts`, { params: { storeid: storeid || '' } });
    }

    createShift(body:any): Observable<any> {
        return this.http.post(`${this.apiurl}/store-cash/shifts`, body);
    }

    assignShift(id:any, body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/store-cash/shifts/${id}/assign`, body);
    }

    closeShift(id:any, body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/store-cash/shifts/${id}/close`, body);
    }

    getReturnRules(): Observable<any> {
        return this.http.get(`${this.apiurl}/sales/return-rules`);
    }

    saveReturnRule(category:string, rule:string|null): Observable<any> {
        return this.http.put(`${this.apiurl}/sales/return-rules`, { category, rule });
    }

    getStoreProfile(storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/profile`, { params: { storeid: String(storeid) } });
    }

    saveStoreProfile(id:any, body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/stores/${id}/profile`, body);
    }

    getShiftSummary(id:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/shifts/${id}/summary`);
    }

    getShiftReport(id:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/shifts/${id}/report`);
    }

    getLedger(storeid:any, shiftid:any = ''): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/ledger`, { params: { storeid: storeid || '', shiftid: shiftid || '' } });
    }

    saveLedger(body:any): Observable<any> {
        return this.http.post(`${this.apiurl}/store-cash/ledger`, body);
    }

    getExpenseSummary(storeid:any): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/expenses/summary`, { params: { storeid: storeid || '' } });
    }

}

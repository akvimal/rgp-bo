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

    updateStore(id:any, body:any): Observable<any> {
        return this.http.put(`${this.apiurl}/stores/${id}`, body);
    }

    deleteStore(id:any): Observable<any> {
        return this.http.delete(`${this.apiurl}/stores/${id}`);
    }

    getUsers(): Observable<any> {
        return this.http.get(`${this.apiurl}/store-cash/users`);
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

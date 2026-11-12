import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../../environments/environment";

/** Out-passes for goods that leave the shop as waste, and the expiry list they start from. */
@Injectable({ providedIn: 'root' })
export class DisposalService {
    private api = `${environment.apiHost}/disposal`;
    constructor(private http: HttpClient) {}

    expiry(storeid: any): Observable<any> { return this.http.get(`${this.api}/expiry`, { params: storeid ? { storeid } : {} }); }
    list(params: any = {}): Observable<any> { return this.http.get(this.api, { params }); }
    get(id: number): Observable<any> { return this.http.get(`${this.api}/${id}`); }
    witnesses(storeid: any): Observable<any> { return this.http.get(`${this.api}/witnesses`, { params: { storeid } }); }
    create(body: any): Observable<any> { return this.http.post(this.api, body); }
    update(id: number, body: any): Observable<any> { return this.http.put(`${this.api}/${id}`, body); }
    approve(id: number): Observable<any> { return this.http.post(`${this.api}/${id}/approve`, {}); }
    reject(id: number, note: string): Observable<any> { return this.http.post(`${this.api}/${id}/reject`, { note }); }
    cancel(id: number, note = ''): Observable<any> { return this.http.post(`${this.api}/${id}/cancel`, { note }); }
    confirm(id: number, body: any): Observable<any> { return this.http.post(`${this.api}/${id}/confirm`, body); }
    pdf(id: number): Observable<Blob> { return this.http.get(`${this.api}/${id}/pdf`, { responseType: 'blob' }); }
    backlog(body: any): Observable<any> { return this.http.post(`${this.api}/backlog`, body); }
    legacy(params: any = {}): Observable<any> { return this.http.get(`${this.api}/legacy`, { params }); }
    tagLegacy(ids: number[], tag: string | null): Observable<any> { return this.http.post(`${this.api}/legacy/tag`, { ids, tag }); }
    statement(params: any = {}): Observable<any> { return this.http.get(`${this.api}/statement`, { params }); }
    statementXlsx(params: any = {}): Observable<Blob> { return this.http.get(`${this.api}/statement.xlsx`, { params, responseType: 'blob' }); }
    msg(err: any, fallback = 'Something went wrong.'): string { const m = err?.error?.message; return Array.isArray(m) ? m.join(' ') : (m || fallback); }
}

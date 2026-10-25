import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class FinanceService {
    private api = `${environment.apiHost}/finance`;

    constructor(private http: HttpClient) {}

    accounts() { return this.http.get<any>(`${this.api}/accounts`); }
    saveAccount(id: number | null, body: any) { return id ? this.http.put<any>(`${this.api}/accounts/${id}`, body) : this.http.post<any>(`${this.api}/accounts`, body); }
    imports(id: number) { return this.http.get<any[]>(`${this.api}/accounts/${id}/imports`); }

    private form(file: File, mapping?: any) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        if (mapping) fd.append('mapping', JSON.stringify(mapping));
        return fd;
    }
    preview(id: number, file: File, mapping?: any) { return this.http.post<any>(`${this.api}/accounts/${id}/preview`, this.form(file, mapping)); }
    importFile(id: number, file: File, mapping?: any) { return this.http.post<any>(`${this.api}/accounts/${id}/import`, this.form(file, mapping)); }

    lines(q: any) {
        const params: any = {};
        Object.keys(q).forEach((k) => { if (q[k] !== null && q[k] !== undefined && q[k] !== '') params[k] = String(q[k]); });
        return this.http.get<any>(`${this.api}/lines`, { params });
    }
    tag(id: number, body: any) { return this.http.put<any>(`${this.api}/lines/${id}`, body); }
    rules() { return this.http.get<any[]>(`${this.api}/rules`); }
    removeRule(id: number) { return this.http.delete<any>(`${this.api}/rules/${id}`); }

    month(account: number, month: string) { return this.http.get<any>(`${this.api}/reconcile`, { params: { account: String(account), month } }); }
    signed(account: number) { return this.http.get<any[]>(`${this.api}/reconcile/signed`, { params: { account: String(account) } }); }
    signoff(body: any) { return this.http.post<any>(`${this.api}/reconcile/signoff`, body); }
    reopen(body: any) { return this.http.post<any>(`${this.api}/reconcile/reopen`, body); }

    overview(q: any) {
        const params: any = {};
        Object.keys(q).forEach((k) => { if (q[k] !== null && q[k] !== undefined && q[k] !== '') params[k] = String(q[k]); });
        return this.http.get<any>(`${this.api}/overview`, { params });
    }
    records() { return this.http.get<any>(`${this.api}/records`); }
    drugCoverage() { return this.http.get<any>(`${environment.apiHost}/schedule/coverage`); }
    attest(body: any) { return this.http.post<any>(`${this.api}/records/attest`, body); }
}

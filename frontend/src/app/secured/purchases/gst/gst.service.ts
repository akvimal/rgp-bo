import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({
    providedIn: 'root'
})
export class GstService {

    apiurl = `${environment.apiHost}/gst`;

    constructor(private http: HttpClient) {}

    listPeriods() {
        return this.http.get<any[]>(`${this.apiurl}/periods`);
    }

    summary(period: string) {
        return this.http.get<any>(`${this.apiurl}/summary`, { params: { period } });
    }

    worklist(period: string, status?: string) {
        const params: any = { period };
        if (status) {
            params.status = status;
        }
        return this.http.get<any[]>(`${this.apiurl}/worklist`, { params });
    }

    import(period: string, source: '2A' | '2B', file: any) {
        return this.http.post(`${this.apiurl}/import`, { period, source, file });
    }

    runMatch(period: string) {
        return this.http.post<any>(`${this.apiurl}/match`, { period });
    }

    accept(id: number, note?: string) {
        return this.http.post(`${this.apiurl}/reconciliation/${id}/accept`, { note });
    }

    dispute(id: number, note: string) {
        return this.http.post(`${this.apiurl}/reconciliation/${id}/dispute`, { note });
    }

    exclude(id: number, note?: string) {
        return this.http.post(`${this.apiurl}/reconciliation/${id}/exclude`, { note });
    }

    carryForward(id: number, note?: string) {
        return this.http.post(`${this.apiurl}/reconciliation/${id}/carry-forward`, { note });
    }

    createInvoice(id: number) {
        return this.http.post(`${this.apiurl}/reconciliation/${id}/create-invoice`, {});
    }

    lockPeriod(period: string) {
        return this.http.post(`${this.apiurl}/periods/${period}/lock`, {});
    }
}

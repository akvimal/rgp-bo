import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class DrugRegisterService {
    private api = `${environment.apiHost}/schedule`;

    constructor(private http: HttpClient) {}

    config() { return this.http.get<{ required: string[]; since: string; enforce: string[] }>(`${this.api}/config`); }
    /** the prescriptions kept with a customer and the patient and prescriber of their last supplies */
    customerContext(customerId: number) { return this.http.get<{ prescriptions: any[]; last: any[]; patients?: any[]; prescribers?: any[]; standing_months: number }>(`${this.api}/customer/${customerId}/context`); }
    prescribers(q: string) { return this.http.get<any[]>(`${this.api}/prescribers`, { params: { q } }); }

    private params(q: any) {
        const p: any = {};
        Object.keys(q).forEach((k) => { if (q[k] !== null && q[k] !== undefined && q[k] !== '') p[k] = String(q[k]); });
        return p;
    }
    register(q: any) { return this.http.get<any>(`${this.api}/register`, { params: this.params(q) }); }
    file(kind: 'pdf' | 'xlsx', q: any) { return this.http.get(`${this.api}/register/${kind}`, { params: this.params(q), responseType: 'blob' }); }
    coverage() { return this.http.get<any>(`${this.api}/coverage`); }
    /** how the scheduled supplies of a period were covered, by schedule and by the person who made the sale */
    coverageReport(q: any) { return this.http.get<any>(`${this.api}/coverage-report`, { params: this.params(q) }); }
    /** the prescriptions promised for later and not yet brought */
    followups() { return this.http.get<{ rows: any[] }>(`${this.api}/followups`); }
    waiveFollowup(id: number, note: string) { return this.http.post<any>(`${this.api}/followups/${id}/waive`, { note }); }
    /** the supplies made with no prescription in hand, which have no prescriber yet */
    prescriberGaps() { return this.http.get<{ rows: any[] }>(`${this.api}/prescriber-gaps`); }
    /** the prescriber of such a supply, once the prescription has arrived */
    addPrescriber(saleId: number, detail: any) { return this.http.post<any>(`${this.api}/sales/${saleId}/prescriber`, detail); }
    /** the patient and the prescriber for a bill that was completed without them */
    addDetails(saleId: number, detail: any) { return this.http.post<any>(`${this.api}/sales/${saleId}/details`, detail); }
}

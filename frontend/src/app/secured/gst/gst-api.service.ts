import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

/** GST for the Business Head: rate changes, HSN, registration, the sales register and the monthly summary. */
@Injectable({ providedIn: 'root' })
export class GstApiService {
    private api = `${environment.apiHost}/gst`;

    constructor(private http: HttpClient) {}

    // registration
    registration() { return this.http.get<any>(`${this.api}/registration`); }
    saveRegistration(body: any) { return this.http.put<any>(`${this.api}/registration`, body); }

    // register, HSN summary, monthly summary and closing a month
    salesRegister(month: string) { return this.http.get<any>(`${this.api}/sales-register`, { params: { month } }); }
    hsnSummary(month: string) { return this.http.get<any>(`${this.api}/hsn-summary`, { params: { month } }); }
    monthlySummary(month: string) { return this.http.get<any>(`${this.api}/monthly-summary`, { params: { month } }); }
    months() { return this.http.get<any>(`${this.api}/months`); }
    closeMonth(month: string, body: any) { return this.http.post<any>(`${this.api}/months/${month}/close`, body); }
    reopenMonth(month: string, reason: string) { return this.http.post<any>(`${this.api}/months/${month}/reopen`, { reason }); }
    file(path: string, month: string) { return this.http.get(`${this.api}/${path}`, { params: { month }, responseType: 'blob' }); }

    // rate changes
    rateChanges() { return this.http.get<any>(`${this.api}/rate-changes`); }
    previewChange(body: any) { return this.http.post<any>(`${this.api}/rate-changes/preview`, body); }
    createChange(body: any) { return this.http.post<any>(`${this.api}/rate-changes`, body); }
    cancelChange(id: number) { return this.http.delete<any>(`${this.api}/rate-changes/${id}`); }
    changeReport(id: number) { return this.http.get<any>(`${this.api}/rate-changes/${id}/report`); }

    // HSN
    missingHsn() { return this.http.get<any>(`${this.api}/hsn/missing`); }
    setHsn(items: any[]) { return this.http.put<any>(`${this.api}/hsn/products`, { items }); }
    setCategoryHsn(body: any) { return this.http.put<any>(`${this.api}/hsn/category`, body); }
    applyCategoryHsn(category: string) { return this.http.post<any>(`${this.api}/hsn/category/apply`, { category }); }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { DenominationRow } from "src/app/shared/denominations";

/** The store vault: cash kept apart from the shift drawer until it is banked. */
@Injectable({ providedIn: "root" })
export class VaultService {
  private base = `${environment.apiHost}/store-vault`;

  constructor(private http: HttpClient) {}

  state(storeid: number): Observable<any> { return this.http.get(`${this.base}/${storeid}`); }

  movements(storeid: number, query: { from?: string; to?: string; type?: string; limit?: number } = {}): Observable<any> {
    const params: any = {};
    Object.keys(query).forEach(k => { if ((query as any)[k] !== undefined && (query as any)[k] !== "") params[k] = (query as any)[k]; });
    return this.http.get(`${this.base}/${storeid}/movements`, { params });
  }

  opening(storeid: number, denominations: DenominationRow[], notes?: string): Observable<any> { return this.http.post(`${this.base}/${storeid}/opening`, { denominations, notes }); }
  deposit(storeid: number, body: { denominations: DenominationRow[]; referenceno?: string; transdate?: string; notes?: string }): Observable<any> { return this.http.post(`${this.base}/${storeid}/deposit`, body); }
  dropNow(storeid: number, shiftid: number, denominations: DenominationRow[], notes?: string): Observable<any> { return this.http.post(`${this.base}/${storeid}/drop-now`, { shiftid, denominations, notes }); }
  change(storeid: number, denominations: DenominationRow[], notes?: string): Observable<any> { return this.http.post(`${this.base}/${storeid}/change`, { denominations, notes }); }
  count(storeid: number, denominations: DenominationRow[], notes?: string): Observable<any> { return this.http.post(`${this.base}/${storeid}/count`, { denominations, notes }); }
  adjust(storeid: number, body: { direction: "IN" | "OUT"; denominations: DenominationRow[]; reason: string; notes?: string }): Observable<any> { return this.http.post(`${this.base}/${storeid}/adjust`, body); }
  confirm(id: string): Observable<any> { return this.http.post(`${this.base}/movements/${id}/confirm`, {}); }
  reject(id: string, reason: string): Observable<any> { return this.http.post(`${this.base}/movements/${id}/reject`, { reason }); }
}

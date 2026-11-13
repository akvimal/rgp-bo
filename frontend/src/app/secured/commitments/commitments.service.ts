import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

/** Customer commitments: orders taken at the counter and paid in advance (api: /commitments). */
@Injectable({ providedIn: "root" })
export class CommitmentsService {
  private base = `${environment.apiHost}/commitments`;
  constructor(private http: HttpClient) {}

  list(params: { status?: string; storeid?: number | null; customerid?: number; q?: string }): Observable<any[]> {
    const q: any = {};
    Object.keys(params).forEach(k => { const v = (params as any)[k]; if (v !== undefined && v !== null && v !== "") q[k] = v; });
    return this.http.get<any[]>(this.base, { params: q });
  }
  settings(): Observable<any> { return this.http.get<any>(`${this.base}/settings`); }
  get(id: number): Observable<any> { return this.http.get<any>(`${this.base}/${id}`); }
  create(body: any): Observable<any> { return this.http.post<any>(this.base, body); }
  pay(id: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/${id}/payments`, body); }
  refund(id: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/${id}/refund`, body); }
  cancel(id: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/${id}/cancel`, body); }
  notified(id: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/${id}/notified`, body); }
  raiseRequests(id: number): Observable<any> { return this.http.post<any>(`${this.base}/${id}/requests`, {}); }
  link(lineid: number, requestid: number): Observable<any> { return this.http.post<any>(`${this.base}/lines/${lineid}/link`, { requestid }); }
  /** purchase requests a line could be linked to (the same product, still to come) */
  requests(): Observable<any[]> { return this.http.get<any[]>(`${environment.apiHost}/purchaserequests`); }
}

/** the words for a commitment's status */
export const STATUS_LABEL: { [k: string]: string } = {
  OPEN: "Taken", ORDERED: "On order", READY: "Arrived", COLLECTED: "Collected", CANCELLED: "Cancelled"
};
export const STATUS_CLASS: { [k: string]: string } = {
  OPEN: "bg-secondary", ORDERED: "bg-info text-dark", READY: "bg-success", COLLECTED: "bg-light text-dark border", CANCELLED: "bg-light text-muted border"
};

export function errorText(e: any, fallback: string): string {
  const m = e?.error?.message;
  return (Array.isArray(m) ? m.join(" ") : m) || fallback;
}

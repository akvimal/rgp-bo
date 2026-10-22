import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

/** thin wrappers over /my-hr and /leave-approvals; the server only ever returns the signed-in person's own data */
@Injectable({ providedIn: "root" })
export class MyHrApi {
  private readonly api = `${environment.apiHost}/my-hr`;
  private readonly approvals = `${environment.apiHost}/leave-approvals`;
  constructor(private http: HttpClient) {}

  get<T = any>(path: string, params: any = {}): Observable<T> { return this.http.get<T>(`${this.api}/${path}`, { params }); }
  post<T = any>(path: string, body: any = {}): Observable<T> { return this.http.post<T>(`${this.api}/${path}`, body); }
  put<T = any>(path: string, body: any = {}): Observable<T> { return this.http.put<T>(`${this.api}/${path}`, body); }

  approvalList(status: string): Observable<any[]> { return this.http.get<any[]>(this.approvals, { params: { status } }); }
  approvalCount(): Observable<any> { return this.http.get(`${this.approvals}/count`); }
  decide(id: number, body: any): Observable<any> { return this.http.post(`${this.approvals}/${id}/decision`, body); }

  msg(err: any, fallback = "Something went wrong."): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }
  today(): string { return new Date().toISOString().slice(0, 10); }
}

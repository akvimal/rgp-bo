import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

/** thin wrappers over /inquiries; the server decides who may do what */
@Injectable({ providedIn: "root" })
export class InquiryApi {
  private readonly api = `${environment.apiHost}/inquiries`;
  constructor(private http: HttpClient) {}

  get<T = any>(path = "", params: any = {}): Observable<T> { return this.http.get<T>(`${this.api}${path ? "/" + path : ""}`, { params }); }
  post<T = any>(path = "", body: any = {}): Observable<T> { return this.http.post<T>(`${this.api}${path ? "/" + path : ""}`, body); }
  put<T = any>(path: string, body: any = {}): Observable<T> { return this.http.put<T>(`${this.api}/${path}`, body); }

  msg(err: any, fallback = "Something went wrong."): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }
  tomorrow(): string { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
}

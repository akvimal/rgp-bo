import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

/** thin wrappers over /kpi; the server decides who may rate whom */
@Injectable({ providedIn: "root" })
export class KpiApi {
  private readonly api = `${environment.apiHost}/kpi`;
  constructor(private http: HttpClient) {}

  month(period: string): Observable<any[]> { return this.http.get<any[]>(`${this.api}/rate`, { params: { period } }); }
  rate(body: any): Observable<any> { return this.http.put(`${this.api}/rate`, body); }
  mine(): Observable<any> { return this.http.get(`${this.api}/mine`); }

  msg(err: any, fallback = "Something went wrong."): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }
}

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { AuthService } from "../../@core/auth/auth.service";

/** the attendance punch (store PC) and its review (managers) */
@Injectable({ providedIn: "root" })
export class AttendanceApi {
  private readonly punchUrl = `${environment.apiHost}/punch`;
  private readonly reviewUrl = `${environment.apiHost}/attendance-review`;
  constructor(private http: HttpClient, private auth: AuthService) {}

  /** the PC proves itself with the secret it keeps; the server only accepts a punch from a registered PC */
  private deviceHeaders(): { [h: string]: string } {
    const t = this.auth.getDeviceToken();
    return t ? { "x-device-token": t } : {};
  }

  staff(): Observable<any> { return this.http.get(`${this.punchUrl}/staff`, { headers: this.deviceHeaders() }); }
  punch(body: any): Observable<any> { return this.http.post(this.punchUrl, body, { headers: this.deviceHeaders() }); }

  list(period: string, status: string): Observable<any> { return this.http.get(this.reviewUrl, { params: { period, status } }); }
  people(): Observable<any[]> { return this.http.get<any[]>(`${this.reviewUrl}/people`); }
  day(body: any): Observable<any> { return this.http.post(`${this.reviewUrl}/day`, body); }
  setPin(id: number, body: any): Observable<any> { return this.http.put(`${this.reviewUrl}/people/${id}/pin`, body); }
  photo(id: number): Observable<Blob> { return this.http.get(`${this.reviewUrl}/photo/${id}`, { responseType: "blob" }); }

  msg(err: any, fallback = "Something went wrong."): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }
}

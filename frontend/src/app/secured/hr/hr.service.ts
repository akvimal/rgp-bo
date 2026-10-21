import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

/** thin wrappers over /hr; the server does all the rules */
@Injectable({ providedIn: "root" })
export class HrService {
  private readonly api = `${environment.apiHost}/hr`;
  constructor(private http: HttpClient) {}

  get<T = any>(path: string, params: any = {}): Observable<T> { return this.http.get<T>(`${this.api}/${path}`, { params }); }
  post<T = any>(path: string, body: any = {}): Observable<T> { return this.http.post<T>(`${this.api}/${path}`, body); }
  put<T = any>(path: string, body: any = {}): Observable<T> { return this.http.put<T>(`${this.api}/${path}`, body); }
  delete<T = any>(path: string): Observable<T> { return this.http.delete<T>(`${this.api}/${path}`); }
  blob(path: string): Observable<Blob> { return this.http.get(`${this.api}/${path}`, { responseType: "blob" }); }

  /** the server's message, whatever shape it came in */
  msg(err: any, fallback = "Something went wrong."): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }

  thisMonth(): string { return new Date().toISOString().slice(0, 7); }
  today(): string { return new Date().toISOString().slice(0, 10); }
}

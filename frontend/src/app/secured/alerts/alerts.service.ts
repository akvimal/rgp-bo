import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { environment } from "src/environments/environment";

/** The notification list of the person signed in (the bell and the page share it) and the alert rules of the owner. */
@Injectable({ providedIn: "root" })
export class AlertsService {
  private readonly api = `${environment.apiHost}/alerts`;

  /** the open notifications, newest and most urgent first; refreshed by the bell each minute and after any action */
  items$ = new BehaviorSubject<any[]>([]);
  unread$ = new BehaviorSubject<number>(0);

  constructor(private http: HttpClient) {}

  refresh() {
    this.http.get<any>(`${this.api}/notifications`, { params: { status: 'open', limit: '50' } }).subscribe(
      (r) => { this.items$.next(r.items || []); this.unread$.next(r.unread || 0); },
      () => { /* the bell stays as it was: a missed minute is not worth an error */ });
  }

  list(status: 'open' | 'all') { return this.http.get<any>(`${this.api}/notifications`, { params: { status, limit: '200' } }); }
  read(id: number) { return this.http.post(`${this.api}/notifications/${id}/read`, {}); }
  dismiss(id: number) { return this.http.post(`${this.api}/notifications/${id}/dismiss`, {}); }
  snooze(id: number, hours: number) { return this.http.post(`${this.api}/notifications/${id}/snooze`, { hours }); }
  readAll() { return this.http.post(`${this.api}/notifications/read-all`, {}); }
  prefs() { return this.http.get<any>(`${this.api}/prefs`); }
  savePrefs(language: string) { return this.http.put<any>(`${this.api}/prefs`, { language }); }

  ai() { return this.http.get<any>(`${this.api}/ai`); }
  saveAi(model: string) { return this.http.put<any>(`${this.api}/ai`, { model }); }

  kinds() { return this.http.get<any>(`${this.api}/kinds`); }
  rules() { return this.http.get<any[]>(`${this.api}/rules`); }
  createRule(body: any) { return this.http.post<any>(`${this.api}/rules`, body); }
  updateRule(id: number, body: any) { return this.http.put<any>(`${this.api}/rules/${id}`, body); }
  removeRule(id: number) { return this.http.delete(`${this.api}/rules/${id}`); }
  preview(body: any) { return this.http.post<any>(`${this.api}/rules/preview`, body); }
  draft(instruction: string) { return this.http.post<any>(`${this.api}/rules/draft`, { instruction }); }
  runNow() { return this.http.post(`${this.api}/run`, {}); }
}

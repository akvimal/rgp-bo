import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

/** The insight features: ask the shop, the buying brief and expiry risk, the weekly owner summary and staff coaching notes. */
@Injectable({ providedIn: "root" })
export class InsightsService {
  private readonly api = `${environment.apiHost}/insights`;

  constructor(private http: HttpClient) {}

  // ---- ask the shop
  reports() { return this.http.get<any>(`${this.api}/ask/reports`); }
  run(body: { report: string; period?: string; limit?: number; days?: number }) { return this.http.post<any>(`${this.api}/ask/run`, body); }
  ask(question: string) { return this.http.post<any>(`${this.api}/ask`, { question }); }

  // ---- buying
  expiryRisk(days = 180) { return this.http.get<any>(`${this.api}/expiry-risk`, { params: { days: String(days) } }); }
  buyingBrief(reorder: any[]) { return this.http.post<any>(`${this.api}/buying-brief`, { reorder }); }

  // ---- the weekly summary
  weekly() { return this.http.get<any>(`${this.api}/weekly`); }
  makeWeekly(force = false) { return this.http.post<any>(`${this.api}/weekly/generate`, { force }); }
  sendWeekly(id?: number) { return this.http.post<any>(`${this.api}/weekly/send`, { id }); }
  weeklyTelegram(on: boolean) { return this.http.put<any>(`${this.api}/weekly/telegram`, { on }); }

  // ---- coaching
  coachingPeople(period?: string) { return this.http.get<any>(`${this.api}/coaching`, { params: period ? { period } : {} }); }
  coaching(id: number, period?: string) { return this.http.get<any>(`${this.api}/coaching/${id}`, { params: period ? { period } : {} }); }
  draftCoaching(id: number, period: string) { return this.http.post<any>(`${this.api}/coaching/${id}/draft`, { period }); }
  saveCoaching(id: number, body: any) { return this.http.put<any>(`${this.api}/coaching/${id}`, body); }
  myCoaching() { return this.http.get<any>(`${this.api}/coaching/mine`); }
}

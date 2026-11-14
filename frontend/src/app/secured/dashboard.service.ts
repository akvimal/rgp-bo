import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class DashboardService {
  constructor(private http: HttpClient) {}

  getMine() {
    return this.http.get(`${environment.apiHost}/dashboard/mine`);
  }

  getView() {
    return this.http.get(`${environment.apiHost}/dashboard/view`);
  }

  getSummary(storeid?: number | null) {
    const params: any = {};
    if (storeid !== null && storeid !== undefined) {
      params.storeid = storeid;
    }
    return this.http.get(`${environment.apiHost}/dashboard/summary`, { params });
  }

  getTrends(storeid?: number | null) {
    const params: any = {};
    if (storeid !== null && storeid !== undefined) {
      params.storeid = storeid;
    }
    return this.http.get(`${environment.apiHost}/dashboard/trends`, { params });
  }

  getAdminSummary() {
    return this.http.get(`${environment.apiHost}/dashboard/admin-summary`);
  }

  private scoped(storeid?: number | null) {
    return storeid !== null && storeid !== undefined ? { storeid } : {};
  }

  getHealth(storeid?: number | null) {
    return this.http.get(`${environment.apiHost}/dashboard/health`, { params: this.scoped(storeid) as any });
  }

  getTargets(month?: string) {
    return this.http.get(`${environment.apiHost}/dashboard/targets`, { params: (month ? { month } : {}) as any });
  }

  suggestTargets(month: string | undefined, growth: number) {
    return this.http.get(`${environment.apiHost}/dashboard/targets/suggest`, { params: { ...(month ? { month } : {}), growth: String(growth) } as any });
  }

  setTarget(body: { month: string; storeid?: number | null; value: number | null }) {
    return this.http.put(`${environment.apiHost}/dashboard/targets`, body);
  }

  getTiles(storeid?: number | null, compare: string = 'prev') {
    return this.http.get(`${environment.apiHost}/dashboard/tiles`, { params: { ...this.scoped(storeid), compare } as any });
  }

  getFindings(storeid?: number | null) {
    return this.http.get(`${environment.apiHost}/dashboard/findings`, { params: this.scoped(storeid) as any });
  }

  snoozeFinding(body: { key: string; until: string; reason: string }) {
    return this.http.post(`${environment.apiHost}/dashboard/findings/snooze`, body);
  }

  unsnoozeFinding(key: string) {
    return this.http.delete(`${environment.apiHost}/dashboard/findings/snooze`, { params: { key } });
  }

  getPatterns(storeid?: number | null, category?: string | null) {
    return this.http.get(`${environment.apiHost}/dashboard/metrics/patterns`, { params: { ...this.scoped(storeid), ...(category ? { category } : {}) } as any });
  }

  getMetric(name: string, storeid?: number | null) {
    return this.http.get(`${environment.apiHost}/dashboard/metrics/${name}`, { params: this.scoped(storeid) as any });
  }
}

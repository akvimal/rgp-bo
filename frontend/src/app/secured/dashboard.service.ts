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
}

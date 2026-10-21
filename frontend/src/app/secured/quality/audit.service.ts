import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class AuditService {
  private readonly apiurl = `${environment.apiHost}/audit`;

  constructor(private readonly http: HttpClient) {}

  search(filter: any) {
    const params: any = {};
    Object.keys(filter).forEach(k => { if (filter[k] !== null && filter[k] !== undefined && filter[k] !== "") params[k] = String(filter[k]); });
    return this.http.get<{ total: number; rows: any[] }>(this.apiurl, { params });
  }

  users() {
    return this.http.get<any[]>(`${this.apiurl}/users`);
  }
}

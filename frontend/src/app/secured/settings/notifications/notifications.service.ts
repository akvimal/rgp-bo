import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class NotificationsService {
  private readonly apiurl = `${environment.apiHost}/notifications`;

  constructor(private readonly http: HttpClient) {}

  getConfig() {
    return this.http.get<any>(`${this.apiurl}/config`);
  }

  saveConfig(body: any) {
    return this.http.put<any>(`${this.apiurl}/config`, body);
  }

  sendTest(chatid: string) {
    return this.http.post<any>(`${this.apiurl}/test`, { chatid });
  }

  preview(date: string, storeid?: number | null) {
    const params: any = { date };
    if (storeid) params.storeid = storeid;
    return this.http.get<any[]>(`${this.apiurl}/daily/preview`, { params });
  }

  sendNow(date: string, force: boolean) {
    return this.http.post<any[]>(`${this.apiurl}/daily/send`, null, { params: { date, force: String(force) } });
  }

  getLog(limit = 30) {
    return this.http.get<any[]>(`${this.apiurl}/log`, { params: { limit: String(limit) } });
  }
}

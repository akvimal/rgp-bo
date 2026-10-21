import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class GrievancesService {
  private readonly apiurl = `${environment.apiHost}/grievances`;

  constructor(private readonly http: HttpClient) {}

  list(filter: any) {
    const params: any = {};
    Object.keys(filter).forEach(k => { if (filter[k] !== "" && filter[k] !== null && filter[k] !== undefined && filter[k] !== false) params[k] = String(filter[k]); });
    return this.http.get<any[]>(this.apiurl, { params });
  }
  summary() { return this.http.get<any>(`${this.apiurl}/summary`); }
  get(id: number) { return this.http.get<any>(`${this.apiurl}/${id}`); }
  create(body: any) { return this.http.post<{ id: number }>(this.apiurl, body); }
  update(id: number, body: any) { return this.http.put<any>(`${this.apiurl}/${id}`, body); }
  addNote(id: number, note: string) { return this.http.post<any>(`${this.apiurl}/${id}/notes`, { note }); }
  people() { return this.http.get<any[]>(`${this.apiurl}/people`); }
  stores() { return this.http.get<any[]>(`${this.apiurl}/stores`); }
  customers(q: string) { return this.http.get<any[]>(`${this.apiurl}/customers`, { params: { q } }); }
  bills(billno: number) { return this.http.get<any[]>(`${this.apiurl}/bills`, { params: { billno: String(billno) } }); }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class BusinessesService {
  private readonly apiurl = environment.apiHost;

  constructor(private readonly http: HttpClient) {}

  getBusinesses() {
    return this.http.get(`${this.apiurl}/businesses`);
  }

  getStores() {
    return this.http.get(`${this.apiurl}/stores`);
  }

  getUsers() {
    return this.http.get(`${this.apiurl}/users`);
  }

  createBusiness(body: any) {
    return this.http.post(`${this.apiurl}/businesses`, body);
  }

  updateBusiness(id: number, body: any) {
    return this.http.put(`${this.apiurl}/businesses/${id}`, body);
  }

  deleteBusiness(id: number) {
    return this.http.delete(`${this.apiurl}/businesses/${id}`);
  }
}

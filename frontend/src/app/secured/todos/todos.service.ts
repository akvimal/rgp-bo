import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class TodoService {
    private api = `${environment.apiHost}/todos`;

    constructor(private http: HttpClient) {}

    list(scope: 'mine' | 'team', status: 'open' | 'done' = 'open') { return this.http.get<any>(this.api, { params: { scope, status } }); }
    options() { return this.http.get<any>(`${this.api}/options`); }
    create(body: any) { return this.http.post<any>(this.api, body); }
    update(id: number, body: any) { return this.http.put<any>(`${this.api}/${id}`, body); }
    done(id: number, body: any = {}) { return this.http.post<any>(`${this.api}/${id}/done`, body); }
    reopen(id: number) { return this.http.post<any>(`${this.api}/${id}/reopen`, {}); }
    remove(id: number) { return this.http.delete<any>(`${this.api}/${id}`); }
    repeats() { return this.http.get<any>(`${this.api}/repeats`); }
    stopRepeat(id: number) { return this.http.delete<any>(`${this.api}/repeats/${id}`); }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class ChecklistsService {
    private api = `${environment.apiHost}/checklists`;

    constructor(private http: HttpClient) {}

    private params(storeid?: number | null): any { return storeid ? { params: { storeid: String(storeid) } } : {}; }

    overview(storeid?: number | null) { return this.http.get<any>(this.api, this.params(storeid)); }
    run(key: string, body: any) { return this.http.post<any>(`${this.api}/${key}/run`, body); }
    history(key: string, storeid?: number | null) { return this.http.get<any>(`${this.api}/${key}/history`, this.params(storeid)); }
    saveList(key: string, body: any) { return this.http.put<any>(`${this.api}/${key}`, body); }
    addList(body: any) { return this.http.post<any>(this.api, body); }
    resetList(key: string, storeid: number | null, scope: 'store' | 'business') {
        return this.http.delete<any>(`${this.api}/${key}`, { params: { ...(storeid ? { storeid: String(storeid) } : {}), scope } });
    }

    tasks(storeid?: number | null) { return this.http.get<any>(`${this.api}/tasks`, this.params(storeid)); }
    saveTask(key: string, body: any) { return this.http.put<any>(`${this.api}/tasks/${key}`, body); }
    resetTask(key: string, storeid: number | null) { return this.http.delete<any>(`${this.api}/tasks/${key}`, this.params(storeid)); }

    // the printed documents (served by the outage controller)
    procedure() { return this.http.get(`${environment.apiHost}/outage/procedure`, { responseType: 'blob' }); }
}

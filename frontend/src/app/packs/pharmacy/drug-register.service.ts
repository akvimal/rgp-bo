import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class DrugRegisterService {
    private api = `${environment.apiHost}/schedule`;

    constructor(private http: HttpClient) {}

    config() { return this.http.get<{ required: string[]; since: string }>(`${this.api}/config`); }
    prescribers(q: string) { return this.http.get<any[]>(`${this.api}/prescribers`, { params: { q } }); }

    private params(q: any) {
        const p: any = {};
        Object.keys(q).forEach((k) => { if (q[k] !== null && q[k] !== undefined && q[k] !== '') p[k] = String(q[k]); });
        return p;
    }
    register(q: any) { return this.http.get<any>(`${this.api}/register`, { params: this.params(q) }); }
    file(kind: 'pdf' | 'xlsx', q: any) { return this.http.get(`${this.api}/register/${kind}`, { params: this.params(q), responseType: 'blob' }); }
    coverage() { return this.http.get<any>(`${this.api}/coverage`); }
}

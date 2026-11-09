import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class CalendarService {
    private api = `${environment.apiHost}/calendar`;

    constructor(private http: HttpClient) {}

    options() { return this.http.get<any>(`${this.api}/options`); }
    entries(from: string, to: string, store?: number | null, types?: string[]) {
        const params: any = { from, to };
        if (store) params.store = String(store);
        if (types && types.length) params.types = types.join(',');
        return this.http.get<any>(this.api, { params });
    }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class OutageKitService {
    private api = `${environment.apiHost}/outage`;

    constructor(private http: HttpClient) {}

    status(storeid?: number | null) {
        return this.http.get<any>(`${this.api}/status`, { params: storeid ? { storeid: String(storeid) } : {} });
    }
    saveReadiness(body: any) { return this.http.post<any>(`${this.api}/readiness`, body); }
    priceList(format: 'pdf' | 'xlsx') { return this.http.get(`${this.api}/price-list`, { params: { format }, responseType: 'blob' }); }
    procedure() { return this.http.get(`${this.api}/procedure`, { responseType: 'blob' }); }
    addEvent(body: any) { return this.http.post<any>(`${this.api}/events`, body); }
    updateEvent(id: number, body: any) { return this.http.put<any>(`${this.api}/events/${id}`, body); }
}

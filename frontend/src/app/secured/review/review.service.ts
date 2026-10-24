import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class ReviewService {
    private api = `${environment.apiHost}/review`;

    constructor(private http: HttpClient) {}

    week(storeid?: number | null, weekstart?: string | null) {
        const params: any = {};
        if (storeid) params.storeid = String(storeid);
        if (weekstart) params.weekstart = weekstart;
        return this.http.get<any>(`${this.api}/week`, { params });
    }
    signoff(body: any) { return this.http.post<any>(`${this.api}/signoff`, body); }
}

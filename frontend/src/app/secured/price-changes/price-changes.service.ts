import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: 'root' })
export class PriceChangesService {
    constructor(private http: HttpClient) {}

    /** what changed in the sale prices between two days (yyyy-mm-dd), grouped into increased and decreased; `min` hides changes smaller than that percent */
    get(from: string, to: string, min: number) {
        const params: any = {};
        if (from) params.from = from;
        if (to) params.to = to;
        if (min > 0) params.min = String(min);
        return this.http.get<any>(`${environment.apiHost}/price-changes`, { params });
    }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export type Step = 'reminder' | 'due' | 'late' | 'escalated' | 'waived' | 'done';

export interface ComplianceItem {
    id: number;
    item_key: string;
    label: string;
    cls: 'legal' | 'cash' | 'operating' | 'customer' | 'people';
    owner: string;
    store_id: number | null;
    location: string | null;
    person_id: number | null;
    person_name: string | null;
    due_on: string;
    step: Step;
    detail: any;
    not_mine: boolean;
    waiver: { status: 'REQUESTED' | 'GRANTED' | 'DECLINED'; reason: string; until: string | null; days: number | null } | null;
}

/** The register of what is owed (RECOGNITION_AND_COMPLIANCE 3). The server decides who sees what and who may waive. */
@Injectable({ providedIn: 'root' })
export class ComplianceService {
    private readonly url = `${environment.apiHost}/compliance`;

    constructor(private http: HttpClient) {}

    mine(): Observable<ComplianceItem[]> { return this.http.get<ComplianceItem[]>(`${this.url}/mine`); }
    store(): Observable<ComplianceItem[]> { return this.http.get<ComplianceItem[]>(`${this.url}/store`); }
    summary(): Observable<{ total: number; needs: number; bySteps: any; byClass: any; can: { request: boolean; decide: boolean } }> { return this.http.get<any>(`${this.url}/summary`); }
    events(id: number): Observable<any[]> { return this.http.get<any[]>(`${this.url}/${id}/events`); }
    notMine(id: number, note?: string) { return this.http.post(`${this.url}/${id}/not-mine`, { note }); }
    requestWaiver(id: number, reason: string) { return this.http.post(`${this.url}/${id}/waiver-request`, { reason }); }
    grantWaiver(id: number, days: number, note?: string) { return this.http.post(`${this.url}/${id}/waiver`, { days, note }); }
    declineWaiver(id: number, note?: string) { return this.http.post(`${this.url}/${id}/waiver`, { grant: false, note }); }
}

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface MyRecognition {
    paused: boolean;
    pausedBy: { label: string; step: string }[];
    awards: { id: number; rule_key: string; name: string; how: string; awarded_on: string; seen: boolean; lapsed_on: string | null; evidence: any }[];
    progress: { rule: string; name: string; how: string; unit: string; value: number; target: number; earned: boolean; note: string | null }[];
    notes: { id: number; text: string; from_name: string; at: string; seen: boolean }[];
    unseen: number;
}

export interface TeamMember {
    id: number;
    name: string;
    role: string;
    badges: { rule: string; name: string; awardedOn: string }[];
    recent: boolean;
    paused: boolean;
    thanked: boolean;
}

/** Badges and thanks (RECOGNITION_AND_COMPLIANCE 4): a person's own, and the team for those who head a store. There is no ranking. */
@Injectable({ providedIn: 'root' })
export class RecognitionService {
    private readonly url = `${environment.apiHost}/recognition`;

    constructor(private http: HttpClient) {}

    mine(): Observable<MyRecognition> { return this.http.get<MyRecognition>(`${this.url}/mine`); }
    team(): Observable<TeamMember[]> { return this.http.get<TeamMember[]>(`${this.url}/team`); }
    seen() { return this.http.post(`${this.url}/seen`, {}); }
    thank(to: number, text: string) { return this.http.post(`${this.url}/thanks`, { to, text }); }
}

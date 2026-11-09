import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "../../../environments/environment";

/** the form is opened from the floating button on any screen; it remembers which screen so the module can be chosen for the person */
@Injectable({ providedIn: 'root' })
export class FeedbackDialogService {
    readonly opened = new Subject<{ route: string }>();
    open(route: string) { this.opened.next({ route }); }
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
    private api = `${environment.apiHost}/feedback`;

    constructor(private http: HttpClient) {}

    options() { return this.http.get<any>(`${this.api}/options`); }
    mine() { return this.http.get<any>(`${this.api}/mine`); }
    inbox(q: { view?: string; kind?: string; module?: string; q?: string }) {
        const params: any = {};
        Object.keys(q).forEach((k) => { const v = (q as any)[k]; if (v) params[k] = v; });
        return this.http.get<any>(`${this.api}/inbox`, { params });
    }
    get(id: number) { return this.http.get<any>(`${this.api}/${id}`); }
    create(body: any) { return this.http.post<any>(this.api, body); }
    reply(id: number, body: any) { return this.http.post<any>(`${this.api}/${id}/reply`, body); }
    setStatus(id: number, body: any) { return this.http.post<any>(`${this.api}/${id}/status`, body); }
    assign(id: number, userId: number | null) { return this.http.post<any>(`${this.api}/${id}/assign`, { user_id: userId }); }
    close(id: number) { return this.http.post<any>(`${this.api}/${id}/close`, {}); }
    reopen(id: number, message: string) { return this.http.post<any>(`${this.api}/${id}/reopen`, { message }); }
}

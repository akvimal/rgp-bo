import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, ReplaySubject } from "rxjs";
import { environment } from "src/environments/environment";

export interface CustomerBadge {
    tier: 'Gold' | 'Silver' | 'Bronze' | null;
    segment: string;
    dueBack: boolean;
    label: string;
    tone: 'gold' | 'silver' | 'bronze' | 'new' | 'watch' | 'plain';
    cue: string;
}

/**
 * The tier and segment badge of a customer, for every screen that shows one. Customers asked for within a moment are fetched in one request, and what is
 * fetched is kept for a few minutes, so a list of 50 customers makes one call and a customer opened twice none.
 */
@Injectable({ providedIn: 'root' })
export class CustomerBadgeService {
    private readonly api = `${environment.apiHost}/customer-relations/badges`;
    private readonly keepMs = 5 * 60 * 1000;
    private known = new Map<number, { at: number; badge: CustomerBadge | null }>();
    private waiting = new Map<number, ReplaySubject<CustomerBadge | null>>();
    private timer: any = null;

    constructor(private http: HttpClient) {}

    get(id: number): Observable<CustomerBadge | null> {
        const hit = this.known.get(id);
        const out = new ReplaySubject<CustomerBadge | null>(1);
        if (hit && Date.now() - hit.at < this.keepMs) { out.next(hit.badge); out.complete(); return out; }
        const pending = this.waiting.get(id);
        if (pending) return pending;
        this.waiting.set(id, out);
        if (!this.timer) this.timer = setTimeout(() => this.flush(), 30);
        return out;
    }

    private flush() {
        this.timer = null;
        const batch = this.waiting;
        this.waiting = new Map();
        const ids = Array.from(batch.keys());
        if (!ids.length) return;
        this.http.get<{ [id: number]: CustomerBadge | null }>(this.api, { params: { ids: ids.join(',') } }).subscribe(
            (r) => batch.forEach((s, id) => { const b = r?.[id] ?? null; this.known.set(id, { at: Date.now(), badge: b }); s.next(b); s.complete(); }),
            () => batch.forEach((s) => { s.next(null); s.complete(); }));
    }
}

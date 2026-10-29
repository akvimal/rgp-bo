import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { environment } from "../../environments/environment";

/**
 * What the app reads to know what kind of business it is serving: the product attributes by category, the document types, the licence types and
 * the words it uses. They come from the server (the base for every business, plus what each pack the business has brings); nothing pharmacy-specific
 * is held here. Loaded after sign-in, and kept for the session so a reload does not flash the wrong words.
 */
@Injectable({
    providedIn: 'root'
})
export class PropsService {
    private readonly key = 'packconfig';

    config$ = new BehaviorSubject<any>(null);

    productProps$ = new BehaviorSubject<any>([]);
    documentProps$ = new BehaviorSubject<any>([]);
    labels$ = new BehaviorSubject<any>({});
    licenceTypes$ = new BehaviorSubject<any[]>([]);

    constructor(private http: HttpClient){
        try { const saved = JSON.parse(sessionStorage.getItem(this.key) || 'null'); if (saved) this.apply(saved, false); } catch { /* storage blocked */ }
    }

    private apply(c: any, keep = true) {
        this.productProps$.next(c.productProps || []);
        this.documentProps$.next(c.documentProps || []);
        this.labels$.next(c.labels || {});
        this.licenceTypes$.next(c.licenceTypes || []);
        this.config$.next(c);
        if (keep) { try { sessionStorage.setItem(this.key, JSON.stringify(c)); } catch { /* storage blocked */ } }
    }

    /** read the configuration again (after sign-in, and when the business type is changed) */
    refresh(done?: () => void) {
        this.http.get(`${environment.apiHost}/packs/config`).subscribe((c: any) => { this.apply(c); done && done(); }, () => done && done());
    }

    forget() { try { sessionStorage.removeItem(this.key); } catch { /* storage blocked */ } }

    getEntityProps(data:any,entity:string){
        return (data || []).find((d:any) => d.entity == entity);
    }

}

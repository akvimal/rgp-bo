import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class StoreContextService {
  private readonly selectedStoreIdKey = "selected_store_id";
  private readonly storesSubject = new BehaviorSubject<any[]>([]);
  private readonly selectedStoreIdSubject = new BehaviorSubject<number | null>(this.readStoredSelectedStoreId());

  stores$ = this.storesSubject.asObservable();
  selectedStoreId$ = this.selectedStoreIdSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadContext(): Observable<any> {
    return this.http.get(`${environment.apiHost}/stores/context`).pipe(tap((context: any) => {
      this.storesSubject.next(context?.stores || []);
      if (context?.allstores) {
        this.setSelectedStoreId(null, false);
        return;
      }
      const selected = context?.selectedstoreid === null || context?.selectedstoreid === undefined || context?.selectedstoreid === ""
        ? null
        : Number(context.selectedstoreid);
      const stored = this.readStoredSelectedStoreId();
      const resolved = this.isValidSelection(stored, context?.stores) ? stored : selected;
      this.setSelectedStoreId(resolved, false);
    }));
  }

  get stores(): any[] {
    return this.storesSubject.value || [];
  }

  /** the store a store-level screen works on: the one picked, or the only one the business has (there is no picker then) */
  effectiveStoreId(id: number | null = this.selectedStoreId): number | null {
    if (id !== null && id !== undefined) return Number(id);
    return this.stores.length === 1 ? Number(this.stores[0].id) : null;
  }

  get selectedStoreId(): number | null {
    return this.selectedStoreIdSubject.value;
  }

  setSelectedStoreId(id: number | null, persist = true) {
    this.selectedStoreIdSubject.next(id === null || id === undefined || id === ("" as any) ? null : Number(id));
    if (persist) {
      if (id === null || id === undefined || id === ("" as any)) {
        localStorage.removeItem(this.selectedStoreIdKey);
      } else {
        localStorage.setItem(this.selectedStoreIdKey, String(id));
      }
    }
  }

  private readStoredSelectedStoreId(): number | null {
    const raw = localStorage.getItem(this.selectedStoreIdKey);
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isValidSelection(storeId: number | null, stores: any[]): boolean {
    if (storeId === null || storeId === undefined) {
      return true;
    }
    return Array.isArray(stores) ? stores.some((store) => Number(store.id) === Number(storeId)) : false;
  }
}

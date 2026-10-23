import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { environment } from "../../environments/environment";
import { OperatorContextService } from "./operator-context.service";

/**
 * The open shift (if any) for the store currently selected in the header.
 * Shared by the header shift pill and the POS "My Shift" card so both stay in
 * sync; call reload() after opening / closing a shift.
 */
@Injectable({ providedIn: "root" })
export class ShiftContextService {
  private readonly openShiftSubject = new BehaviorSubject<any | null>(null);
  openShift$ = this.openShiftSubject.asObservable();
  private readonly profileSubject = new BehaviorSubject<any | null>(null);
  /** how the selected store runs its tills: shiftmode time|staff, operatorrequired, ... */
  profile$ = this.profileSubject.asObservable();

  private lastStoreId: number | null = null;

  constructor(private http: HttpClient, private operatorContext: OperatorContextService) {}

  get profile(): any | null {
    return this.profileSubject.value;
  }

  get staffBased(): boolean {
    return this.profileSubject.value?.shiftmode === "staff";
  }

  get openShift(): any | null {
    return this.openShiftSubject.value;
  }

  refresh(storeId: number | null): void {
    this.lastStoreId = storeId;
    if (storeId === null || storeId === undefined) {
      this.openShiftSubject.next(null);
      return;
    }
    const loadOpen = (profile: any) => {
      const params: any = { storeid: String(storeId), status: "OPEN" };
      if (profile?.shiftmode === "staff") params.mine = "true";
      this.http.get(`${environment.apiHost}/store-cash/shifts`, { params }).subscribe({
        next: (rows: any) => { if (storeId === this.lastStoreId) this.openShiftSubject.next(Array.isArray(rows) && rows.length ? rows[0] : null); },
        error: () => this.openShiftSubject.next(null),
      });
    };
    this.http.get(`${environment.apiHost}/store-cash/profile`, { params: { storeid: String(storeId) } }).subscribe({
      next: (profile: any) => { this.profileSubject.next(profile); this.operatorContext.applyProfile(profile); loadOpen(profile); },
      error: () => loadOpen(this.profileSubject.value),
    });
  }

  reload(): void {
    this.refresh(this.lastStoreId);
  }
}

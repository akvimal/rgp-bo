import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { environment } from "../../environments/environment";

/**
 * The open shift (if any) for the store currently selected in the header.
 * Shared by the header shift pill and the POS "My Shift" card so both stay in
 * sync; call reload() after opening / closing a shift.
 */
@Injectable({ providedIn: "root" })
export class ShiftContextService {
  private readonly openShiftSubject = new BehaviorSubject<any | null>(null);
  openShift$ = this.openShiftSubject.asObservable();

  private lastStoreId: number | null = null;

  constructor(private http: HttpClient) {}

  get openShift(): any | null {
    return this.openShiftSubject.value;
  }

  refresh(storeId: number | null): void {
    this.lastStoreId = storeId;
    if (storeId === null || storeId === undefined) {
      this.openShiftSubject.next(null);
      return;
    }
    this.http
      .get(`${environment.apiHost}/store-cash/shifts`, { params: { storeid: String(storeId), status: "OPEN" } })
      .subscribe({
        next: (rows: any) => this.openShiftSubject.next(Array.isArray(rows) && rows.length ? rows[0] : null),
        error: () => this.openShiftSubject.next(null),
      });
  }

  reload(): void {
    this.refresh(this.lastStoreId);
  }
}

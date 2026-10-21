import { Component, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { StoreContextService } from "../../@core/store-context.service";

@Component({
  selector: "app-staff-sales",
  templateUrl: "./staff-sales.component.html"
})
export class StaffSalesComponent implements OnInit, OnDestroy {
  presets = [
    { key: "today", label: "Today" },
    { key: "7d", label: "Last 7 days" },
    { key: "month", label: "This month" },
    { key: "30d", label: "Last 30 days" },
  ];
  preset = "month";
  from = "";
  to = "";
  rows: any[] = [];
  loading = false;
  error = "";
  sortKey = "value";
  sortDesc = true;
  private storeId: number | null = null;
  private sub?: Subscription;

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  ngOnInit() {
    this.applyPreset("month", false);
    this.storeId = this.storeContext.selectedStoreId;
    this.sub = this.storeContext.selectedStoreId$.subscribe((id: any) => {
      const next = id === null || id === undefined ? null : Number(id);
      if (next !== this.storeId) { this.storeId = next; this.load(); }
    });
    this.load();
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  applyPreset(key: string, reload = true) {
    this.preset = key;
    const t = new Date();
    const start = new Date(t);
    if (key === "7d") start.setDate(t.getDate() - 6);
    else if (key === "30d") start.setDate(t.getDate() - 29);
    else if (key === "month") start.setDate(1);
    this.from = this.fmt(start);
    this.to = this.fmt(t);
    if (reload) this.load();
  }

  customRange() { this.preset = ""; this.load(); }

  load() {
    this.loading = true;
    this.error = "";
    const params: any = { from: this.from, to: this.to };
    if (this.storeId !== null) params.storeid = String(this.storeId);
    this.http.get<any[]>(`${environment.apiHost}/quality/staff-sales`, { params }).subscribe(
      rows => { this.rows = rows || []; this.loading = false; },
      err => { this.error = err?.error?.message || "Could not load staff sales."; this.loading = false; }
    );
  }

  sort(key: string) {
    if (this.sortKey === key) this.sortDesc = !this.sortDesc;
    else { this.sortKey = key; this.sortDesc = true; }
  }

  get sorted(): any[] {
    const k = this.sortKey;
    const dir = this.sortDesc ? -1 : 1;
    return [...this.rows].sort((a, b) => {
      const x = a[k], y = b[k];
      if (typeof x === "string" || typeof y === "string") return dir * String(x ?? "").localeCompare(String(y ?? ""));
      return dir * ((+x || 0) - (+y || 0));
    });
  }

  get totals() {
    const sum = (k: string) => this.rows.reduce((t, r) => t + (+r[k] || 0), 0);
    const value = sum("value"), bills = sum("bills");
    return { value, bills, avg: bills ? value / bills : 0, returns: sum("return_value"), edits: sum("edits") };
  }

  share(r: any): number {
    const t = this.totals.value;
    return t ? Math.round((100 * (+r.value || 0)) / t) : 0;
  }

  /** Flags worth a look: discounts well above the team average, or many edits/returns relative to bills. */
  flags(r: any): string[] {
    const out: string[] = [];
    const bills = this.totals.bills, value = this.totals.value;
    if (this.rows.length > 1 && r.bills >= 20) {
      const teamDisc = this.rows.reduce((t, x) => t + (+x.discount || 0), 0) / Math.max(1, value + this.rows.reduce((t, x) => t + (+x.discount || 0), 0)) * 100;
      if (+r.discount_pct > Math.max(2 * teamDisc, teamDisc + 2)) out.push("High discounts");
      const teamEdit = this.totals.edits / Math.max(1, bills);
      if (r.edits >= 5 && r.edits / r.bills > Math.max(2 * teamEdit, 0.05)) out.push("Many edits");
      const teamRet = this.totals.returns / Math.max(1, value);
      if (+r.return_value > 0 && +r.return_value / Math.max(1, +r.value) > Math.max(2 * teamRet, 0.03)) out.push("High returns");
    }
    return out;
  }

  private fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

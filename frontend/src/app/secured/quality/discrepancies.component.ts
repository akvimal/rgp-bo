import { Component, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { StoreContextService } from "../../@core/store-context.service";

@Component({
  selector: "app-discrepancies",
  templateUrl: "./discrepancies.component.html"
})
export class DiscrepanciesComponent implements OnInit, OnDestroy {
  /** a shortage or excess at or beyond this many rupees is highlighted */
  readonly significant = 100;
  presets = [
    { key: "7d", label: "Last 7 days" },
    { key: "month", label: "This month" },
    { key: "30d", label: "Last 30 days" },
    { key: "90d", label: "Last 90 days" },
  ];
  preset = "month";
  from = "";
  to = "";
  data: any = null;
  loading = false;
  error = "";
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
    else if (key === "90d") start.setDate(t.getDate() - 89);
    else start.setDate(1);
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
    this.http.get<any>(`${environment.apiHost}/quality/discrepancies`, { params }).subscribe(
      d => { this.data = d; this.loading = false; },
      err => { this.error = err?.error?.message || "Could not load the report."; this.loading = false; }
    );
  }

  isSignificant(v: number) { return Math.abs(+v) >= this.significant; }

  private fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { AuthService } from "../../@core/auth/auth.service";
import { StoreContextService } from "../../@core/store-context.service";

const STATUS_LABEL: { [k: string]: string } = { PENDING: "Waiting", SENT: "Sent", DELIVERED: "Delivered", READ: "Read", FAILED: "Failed", SKIPPED: "Skipped" };
const KIND_LABEL: { [k: string]: string } = { BILL: "Bill copy", REFILL: "Refill reminder", DUES: "Dues reminder", DELIVERY: "Delivery update", REVIEW: "Review invitation" };

/** Sell > WhatsApp: what was sent to customers from a store, and whether it arrived. The number, token and switches are under Settings > WhatsApp. */
@Component({ selector: "app-whatsapp", templateUrl: "./whatsapp.component.html" })
export class WhatsappComponent implements OnInit {
  private readonly api = `${environment.apiHost}/whatsapp`;

  stores: any[] = [];
  storeId: number | null = null;
  /** the store's setting as the server returns it (no secrets): whether sending is on, the mode and the limit */
  s: any = null;
  log: any = { messages: [], this_month: 0 };
  error = "";

  constructor(private http: HttpClient, private storeContext: StoreContextService, private auth: AuthService) {}

  /** may open Settings > WhatsApp */
  get canSetup(): boolean { return this.auth.isActionAuthorized('whatsappsettings.manage'); }

  ngOnInit() {
    this.stores = this.storeContext.stores;
    if (!this.stores.length) this.storeContext.loadContext().subscribe(() => { this.stores = this.storeContext.stores; this.pickFirst(); }, () => undefined);
    else this.pickFirst();
  }

  private pickFirst() {
    const id = this.storeContext.effectiveStoreId();
    this.storeId = id ?? (this.stores[0] ? Number(this.stores[0].id) : null);
    if (this.storeId) this.load();
  }

  label(s: any) { return s.name || s.location || `Store ${s.id}`; }
  statusLabel(v: string) { return STATUS_LABEL[v] || v; }
  kindLabel(v: string) { return KIND_LABEL[v] || v; }
  badge(v: string) { return v === "FAILED" ? "bg-danger" : v === "READ" || v === "DELIVERED" ? "bg-success" : v === "SENT" ? "bg-primary" : "bg-secondary"; }

  load() {
    if (!this.storeId) return;
    this.error = "";
    this.http.get<any>(`${this.api}/settings`, { params: { store_id: String(this.storeId) } }).subscribe(r => this.s = r, e => { this.s = null; this.error = this.msg(e); });
    this.loadLog();
  }

  loadLog() {
    if (!this.storeId) return;
    this.http.get<any>(`${this.api}/log`, { params: { store_id: String(this.storeId) } }).subscribe(r => this.log = r, () => this.log = { messages: [], this_month: 0 });
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || e?.message || "Something went wrong.");
  }
}

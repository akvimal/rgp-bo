import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "../../../@core/store-context.service";

/** Settings > WhatsApp: the number and token of one store, the monthly limit, the switches, and a test message. What was sent is under Sell > WhatsApp. */
@Component({ selector: "app-whatsapp-settings", templateUrl: "./whatsapp-settings.component.html" })
export class WhatsappSettingsComponent implements OnInit {
  private readonly api = `${environment.apiHost}/whatsapp`;

  stores: any[] = [];
  storeId: number | null = null;
  s: any = null;
  /** what is typed in the form; the token is only sent when something is typed */
  form: any = { mode: "MOCK", enabled: false, auto_send_bill: false, monthly_cap: 1000, phone_number_id: "", waba_id: "", display_number: "", token: "" };
  testMobile = "";
  message = "";
  error = "";
  busy = false;

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

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

  load() {
    if (!this.storeId) return;
    this.error = ""; this.message = "";
    this.http.get<any>(`${this.api}/settings`, { params: { store_id: String(this.storeId) } }).subscribe(r => {
      this.s = r;
      this.form = { mode: r.mode, enabled: r.enabled, auto_send_bill: r.auto_send_bill, monthly_cap: r.monthly_cap, phone_number_id: r.phone_number_id || "", waba_id: r.waba_id || "", display_number: r.display_number || "", token: "" };
    }, e => { this.s = null; this.error = this.msg(e); });
  }

  save() {
    if (!this.storeId) return;
    this.busy = true; this.error = ""; this.message = "";
    const body: any = { ...this.form, monthly_cap: Number(this.form.monthly_cap) };
    if (!String(body.token || "").trim()) delete body.token;
    this.http.put<any>(`${this.api}/settings/${this.storeId}`, body).subscribe(r => {
      this.busy = false; this.s = r; this.form.token = "";
      this.message = "Saved.";
    }, e => { this.busy = false; this.error = this.msg(e); });
  }

  clearToken() {
    if (!this.storeId) return;
    this.http.put<any>(`${this.api}/settings/${this.storeId}`, { mode: "MOCK", enabled: false, clear_token: true }).subscribe(r => { this.s = r; this.load(); this.message = "Token removed and sending switched off."; }, e => this.error = this.msg(e));
  }

  sendTest() {
    if (!this.storeId) return;
    this.busy = true; this.error = ""; this.message = "";
    this.http.post<any>(`${this.api}/test/${this.storeId}`, { mobile: this.testMobile }).subscribe(r => {
      this.busy = false;
      this.message = r.mode === "MOCK" ? "Test mode: nothing was sent to WhatsApp (the message was only recorded as a trial)." : "Test message sent.";
    }, e => { this.busy = false; this.error = this.msg(e); });
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || e?.message || "Something went wrong.");
  }
}

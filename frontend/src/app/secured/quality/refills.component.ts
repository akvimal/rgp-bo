import { Component, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { StoreContextService } from "../../@core/store-context.service";

@Component({
  selector: "app-refills",
  templateUrl: "./refills.component.html"
})
export class RefillsComponent implements OnInit, OnDestroy {
  readonly buckets = [
    { key: "", label: "Overdue + this week" },
    { key: "OVERDUE", label: "Overdue" },
    { key: "UPCOMING", label: "Due this week" },
    { key: "LAPSED", label: "Lapsed (45+ days late)" },
  ];
  readonly outcomes = [
    { value: "WILL_BUY", label: "Reached - will come in" },
    { value: "NO_ANSWER", label: "No answer - try again soon" },
    { value: "CALLBACK", label: "Asked to call back later" },
    { value: "BOUGHT_ELSEWHERE", label: "Bought elsewhere" },
    { value: "NOT_NEEDED", label: "Stopped / no longer needed" },
  ];

  /** the API leaves the typical bill out for the counter; the column follows */
  get showValue(): boolean { return !!this.data?.rows?.length && this.data.rows[0].typical_value !== undefined; }

  bucket = "";
  showSnoozed = false;
  data: any = null;
  loading = false;
  error = "";
  open: number | null = null;       // customer whose follow-up form is open
  outcome = "WILL_BUY";
  note = "";
  saving = false;
  formError = "";
  private storeId: number | null = null;
  private sub?: Subscription;

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  ngOnInit() {
    this.storeId = this.storeContext.selectedStoreId;
    this.sub = this.storeContext.selectedStoreId$.subscribe((id: any) => {
      const next = id === null || id === undefined ? null : Number(id);
      if (next !== this.storeId) { this.storeId = next; this.load(); }
    });
    this.load();
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  pick(key: string) { this.bucket = key; this.load(); }

  load() {
    this.loading = true;
    this.error = "";
    const params: any = {};
    if (this.bucket) params.bucket = this.bucket;
    if (this.storeId !== null) params.storeid = String(this.storeId);
    if (this.showSnoozed) params.showsnoozed = "true";
    this.http.get<any>(`${environment.apiHost}/refills`, { params }).subscribe(
      d => { this.data = d; this.loading = false; },
      err => { this.error = err?.error?.message || "Could not load refills."; this.loading = false; }
    );
  }

  openForm(customerId: number) {
    this.msgOpen = null;
    this.open = this.open === customerId ? null : customerId;
    this.outcome = "WILL_BUY"; this.note = ""; this.formError = "";
  }

  save(customerId: number) {
    this.saving = true; this.formError = "";
    this.http.post(`${environment.apiHost}/refills/${customerId}/followup`, { outcome: this.outcome, note: this.note || undefined }).subscribe(
      () => { this.saving = false; this.open = null; this.load(); },
      err => { this.saving = false; const m = err?.error?.message; this.formError = Array.isArray(m) ? m.join(" ") : (m || "Could not save."); }
    );
  }

  // ---- the WhatsApp reminder: the shop's own wording, in the customer's language, editable before it is sent
  msgOpen: number | null = null;     // customer whose message panel is open
  msgLang: "en" | "ta" = "en";
  msgText = "";
  msgBusy = false;
  msgError = "";

  openMessage(r: any) {
    if (this.msgOpen === r.customer_id) { this.msgOpen = null; return; }
    this.open = null;
    this.msgOpen = r.customer_id; this.msgError = "";
    let saved: string | null = null;
    try { saved = localStorage.getItem("rgp_followup_lang"); } catch { /* a private window */ }
    this.setLang(r, r.language === "ta" || r.language === "en" ? r.language : (saved === "ta" ? "ta" : "en"), false);
  }

  setLang(r: any, lang: "en" | "ta", remember = true) {
    this.msgLang = lang;
    this.msgText = r.messages?.[lang] || "";
    if (remember) { try { localStorage.setItem("rgp_followup_lang", lang); } catch { /* it just will not be remembered */ } }
  }

  /** open WhatsApp with the (edited) text, then put it on record: the customer leaves the due list for a few days */
  sendMessage(r: any) {
    const text = this.msgText.trim();
    if (!text) { this.msgError = "The message is empty."; return; }
    window.open(this.waLink(r.mobile, text), "_blank", "noopener");
    this.msgBusy = true; this.msgError = "";
    this.http.post(`${environment.apiHost}/refills/${r.customer_id}/followup`, { outcome: "MESSAGED" }).subscribe(
      () => { this.msgBusy = false; this.msgOpen = null; this.load(); },
      err => { this.msgBusy = false; const m = err?.error?.message; this.msgError = "WhatsApp was opened, but it could not be noted here. " + (Array.isArray(m) ? m.join(" ") : (m || "")); }
    );
  }

  waLink(mobile: string, text?: string) { return `https://wa.me/91${mobile}${text ? "?text=" + encodeURIComponent(text) : ""}`; }
  label(value: string) { return value === "MESSAGED" ? "Message sent" : (this.outcomes.find(o => o.value === value)?.label || value); }
  bucketClass(b: string) { return b === "OVERDUE" ? "bg-danger" : b === "UPCOMING" ? "bg-info text-dark" : "bg-secondary"; }
  get conversion(): string {
    const r = this.data?.results;
    return r && r.contacted ? `${r.bought_after} of ${r.contacted}` : "—";
  }
}

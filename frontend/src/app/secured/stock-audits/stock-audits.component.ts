import { AuthService } from "src/app/@core/auth/auth.service";
import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { saveAs } from "file-saver";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";
import { DisposalService } from "src/app/secured/store/stock/disposal.service";

/** Routine stock audits: what is due, who does it, and what each found; plans (Business Head) make them recur. */
@Component({ selector: "app-stock-audits", templateUrl: "./stock-audits.component.html" })
export class StockAuditsComponent implements OnInit {
  private readonly api = `${environment.apiHost}/stock-audits`;

  tab: "OPEN" | "OVERDUE" | "MINE" | "DONE" | "PLANS" | "REGISTER" = "OPEN";
  rows: any[] = [];
  plans: any[] = [];
  summary: any = { open: 0, overdue: 0, done_this_month: 0, variance_value_this_month: 0 };
  opts: any = { stores: [], categories: [], staff: [], canManage: false };
  message = "";
  error = "";

  plan: any = null;       // the plan being added or edited
  skipping: { id: number; reason: string } | null = null;
  assigning: { id: number; assigned_to: number | null } | null = null;

  readonly scopeLabels: { [k: string]: string } = {
    ALL: "Everything", CATEGORY: "One category", ROTATE: "Rotate through categories",
    FAST: "Fast movers (top 30 by sales)", SCHEDULE: "Scheduled drugs (H, H1, X)", EXPIRY: "Expired and expiring batches",
  };

  certifying: { id: number; note: string } | null = null;
  fy: number | null = null;
  reg: any = null;
  asof = new Date().toISOString().slice(0, 10);
  valuation: any = null;

  // ------------------------------------------------------------ expiry inside the audit
  /** the expired and near-expiry batches the audit's count covered: each needs an out-pass or a short explanation before sign-off */
  expiry: any = null;
  expiryAudit: any = null;
  expiryPick: { [itemid: number]: boolean } = {};
  expiryNote: { [itemid: number]: string } = {};
  expiryPass = { reason: "EXPIRED", method: "DESTROYED", agency: "" };
  expiryError = "";
  expiryBusy = false;

  openExpiry(a: any) {
    this.expiryAudit = a; this.expiryError = ""; this.expiryPick = {}; this.expiryNote = {};
    this.loadExpiry();
  }
  closeExpiry() { this.expiry = null; this.expiryAudit = null; }

  private loadExpiry() {
    this.http.get<any>(`${this.api}/${this.expiryAudit.id}/expiry`).subscribe(r => { this.expiry = r; this.expiryPick = {}; }, e => this.expiryError = this.msg(e));
  }

  /** the rows that can go on an out-pass: expired stock still on the books that has no pass yet */
  get expiryPickable(): any[] { return (this.expiry?.rows || []).filter((r: any) => !r.passid && r.sellable > 0); }
  get expiryPicked(): any[] { return this.expiryPickable.filter((r: any) => this.expiryPick[r.itemid]); }

  saveExpiryNote(r: any) {
    this.expiryError = "";
    this.http.post<any>(`${this.api}/${this.expiryAudit.id}/expiry/explain`, { itemid: r.itemid, note: this.expiryNote[r.itemid] ?? r.note ?? "" }).subscribe(x => { this.expiry = x; this.expiryNote = {}; this.load(); }, e => this.expiryError = this.msg(e));
  }

  makeExpiryPass() {
    this.expiryBusy = true; this.expiryError = "";
    const body = { storeid: this.expiryAudit.store_id, auditid: this.expiryAudit.id, reason: this.expiryPass.reason, method: this.expiryPass.method, agency: this.expiryPass.agency,
      lines: this.expiryPicked.map((r: any) => ({ itemid: r.itemid, qty: r.sellable })) };
    this.disposal.create(body).subscribe((p: any) => { this.expiryBusy = false; this.router.navigate(["/secure/store/stock/passes", p.id]); }, (e: any) => { this.expiryBusy = false; this.expiryError = this.disposal.msg(e); });
  }

  constructor(private http: HttpClient, private router: Router, private storeContext: StoreContextService, public auth: AuthService, private disposal: DisposalService) {}

  ngOnInit() {
    this.http.get(`${this.api}/options`).subscribe(o => this.opts = o);
    this.load();
  }

  msg(err: any, fallback = "Something went wrong."): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }

  load() {
    this.error = "";
    if (this.tab === "REGISTER") { this.loadRegister(); return; }
    if (this.tab === "PLANS") { this.http.get<any[]>(`${this.api}/plans`).subscribe(r => this.plans = r, e => this.error = this.msg(e)); return; }
    const q: any = {};
    if (this.tab === "OPEN") q.status = "ACTIVE";
    if (this.tab === "OVERDUE") { q.status = "ACTIVE"; q.overdue = "true"; }
    if (this.tab === "MINE") { q.status = "ACTIVE"; q.mine = "true"; }
    if (this.tab === "DONE") q.status = "ALL";
    this.http.get<any[]>(this.api, { params: q }).subscribe(r => this.rows = this.tab === "DONE" ? r.filter(x => x.status === "DONE" || x.status === "SKIPPED") : r, e => this.error = this.msg(e));
    this.http.get(`${this.api}/summary`).subscribe(s => this.summary = s);
  }

  /** SA-0012 */
  no(n: number) { return n ? `SA-${String(n).padStart(4, "0")}` : ""; }

  /** the store is shown and chosen only when the business has more than one */
  get multiStore(): boolean { return (this.opts.stores || []).length > 1; }

  /** the adjustments this audit raised, with their reasons */
  showAdjustments(a: any) { this.router.navigate(["/secure/store/stock/adjust"], { queryParams: { audit: a.id } }); }

  /** open a PDF in a new tab, or save an Excel file */
  openDoc(path: string, filename?: string) {
    this.error = "";
    this.http.get(`${this.api}/${path}`, { responseType: "blob" }).subscribe((b: Blob) => {
      if (filename && filename.endsWith(".xlsx")) { saveAs(b, filename); return; }
      const url = URL.createObjectURL(b);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, async (e) => {
      // an error body arrives as a blob when the request asked for one
      let m = "Could not make the document.";
      try { m = JSON.parse(await e.error.text()).message || m; } catch { /* keep the default */ }
      this.error = Array.isArray(m) ? (m as any).join(" ") : m;
    });
  }

  confirmCertify() {
    const c = this.certifying!;
    this.http.post<any>(`${this.api}/${c.id}/certify`, { note: c.note }).subscribe(r => {
      this.message = `${r.no} certified. The certificate is kept as printed.`; this.certifying = null; this.load();
    }, e => this.error = this.msg(e));
  }

  standardPlans() {
    this.http.post<any>(`${this.api}/plans/standard`, {}).subscribe(r => {
      this.message = r.created ? `${r.created} standard plan${r.created === 1 ? "" : "s"} added.` : "The standard plans are already set up.";
      this.load();
    }, e => this.error = this.msg(e));
  }

  loadRegister() {
    const p: any = {};
    if (this.fy) p.year = String(this.fy);
    this.http.get<any>(`${this.api}/register`, { params: p }).subscribe(r => { this.reg = r; this.fy = r.fy.year; }, e => this.error = this.msg(e));
    this.loadValuation();
  }

  loadValuation() {
    this.http.get<any>(`${this.api}/valuation`, { params: { asof: this.asof } }).subscribe(v => this.valuation = v, e => this.error = this.msg(e));
  }

  setTab(t: any) { this.tab = t; this.plan = null; this.load(); }

  /** open the stock count screen for this audit; it must be done at the audit's store */
  doAudit(a: any) {
    this.storeContext.setSelectedStoreId(a.store_id);
    this.router.navigate(["/secure/store/stock/count"], { queryParams: { audit: a.id, category: a.category || undefined } });
  }

  generate() {
    this.http.post<any>(`${this.api}/generate`, {}).subscribe(r => { this.message = r.created ? `${r.created} audit${r.created === 1 ? "" : "s"} planned.` : "Nothing new is due yet."; this.load(); }, e => this.error = this.msg(e));
  }

  confirmSkip() {
    const s = this.skipping!;
    this.http.post(`${this.api}/${s.id}/skip`, { reason: s.reason }).subscribe(() => { this.message = "Audit skipped."; this.skipping = null; this.load(); }, e => this.error = this.msg(e));
  }

  confirmAssign() {
    const s = this.assigning!;
    this.http.post(`${this.api}/${s.id}/assign`, { assigned_to: s.assigned_to }).subscribe(() => { this.message = "Audit assigned."; this.assigning = null; this.load(); }, e => this.error = this.msg(e));
  }

  // ------------------------------------------------------------ plans
  addPlan() { this.plan = { id: 0, name: "", store_id: null, scope: "ALL", categories: [], frequency_days: 30, first_due: new Date().toISOString().slice(0, 10), assigned_to: null, active: true }; }
  editPlan(p: any) { this.plan = { ...p, categories: [...(p.categories || [])] }; }
  toggleCategory(c: string) { const a: string[] = this.plan.categories; this.plan.categories = a.includes(c) ? a.filter(x => x !== c) : [...a, c]; }

  savePlan() {
    const p = this.plan;
    const req = p.id ? this.http.put(`${this.api}/plans/${p.id}`, p) : this.http.post(`${this.api}/plans`, p);
    req.subscribe((r: any) => {
      this.message = r?.created
        ? `Plan saved. ${r.created} audit${r.created === 1 ? "" : "s"} planned: see Due.`
        : r?.appears_on ? `Plan saved. Its first audit appears in Due on ${r.appears_on}, a week before it is due.` : "Plan saved.";
      this.plan = null; this.load();
    }, e => this.error = this.msg(e));
  }
}

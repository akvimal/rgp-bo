import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";

/** Routine stock audits: what is due, who does it, and what each found; plans (Business Head) make them recur. */
@Component({ selector: "app-stock-audits", templateUrl: "./stock-audits.component.html" })
export class StockAuditsComponent implements OnInit {
  private readonly api = `${environment.apiHost}/stock-audits`;

  tab: "OPEN" | "OVERDUE" | "MINE" | "DONE" | "PLANS" = "OPEN";
  rows: any[] = [];
  plans: any[] = [];
  summary: any = { open: 0, overdue: 0, done_this_month: 0, variance_value_this_month: 0 };
  opts: any = { stores: [], categories: [], staff: [], canManage: false };
  message = "";
  error = "";

  plan: any = null;       // the plan being added or edited
  skipping: { id: number; reason: string } | null = null;
  assigning: { id: number; assigned_to: number | null } | null = null;

  readonly scopeLabels: { [k: string]: string } = { ALL: "Everything", CATEGORY: "One category", ROTATE: "Rotate through categories" };

  constructor(private http: HttpClient, private router: Router, private storeContext: StoreContextService) {}

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
    if (this.tab === "PLANS") { this.http.get<any[]>(`${this.api}/plans`).subscribe(r => this.plans = r, e => this.error = this.msg(e)); return; }
    const q: any = {};
    if (this.tab === "OPEN") q.status = "ACTIVE";
    if (this.tab === "OVERDUE") { q.status = "ACTIVE"; q.overdue = "true"; }
    if (this.tab === "MINE") { q.status = "ACTIVE"; q.mine = "true"; }
    if (this.tab === "DONE") q.status = "ALL";
    this.http.get<any[]>(this.api, { params: q }).subscribe(r => this.rows = this.tab === "DONE" ? r.filter(x => x.status === "DONE" || x.status === "SKIPPED") : r, e => this.error = this.msg(e));
    this.http.get(`${this.api}/summary`).subscribe(s => this.summary = s);
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
    req.subscribe(() => { this.message = "Plan saved."; this.plan = null; this.load(); }, e => this.error = this.msg(e));
  }
}

import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { BusinessesService } from "../businesses/businesses.service";

/**
 * How the shop runs: pick a staffing preset, see exactly what it would change, apply it. A preset only sets defaults (approvals,
 * which modules show, how each store closes its shifts); users, shifts and history are never touched, and every setting can still be
 * changed on its own afterwards. Switching later is the same page.
 */
@Component({ templateUrl: "./shop-setup.component.html" })
export class ShopSetupComponent implements OnInit {
  private readonly api = `${environment.apiHost}/businesses/mine`;

  presets: any[] = [];
  stores: any[] = [];
  current: string | null = null;
  /** modules the hosted plan leaves out (so the wizard does not ask about them) */
  locked: string[] = [];

  preset = "";
  shiftmode: "time" | "staff" = "time";
  perStore: { [id: string]: "time" | "staff" } = {};
  hr = false;

  plan: any = null;
  logins: any[] = [];
  result: any = null;
  loading = true;
  busy = false;
  error = "";

  readonly loginKinds = ["Counter", "Sales Staff", "Store Head", "Personal"];

  // ---- approvals and modules (the adjustments after the preset)
  approvalMode = 'separate';
  singlePerson = false;
  approvalSaving = false;
  approvalMessage = '';
  approvalError = '';
  modules: any = null;
  modulesSaving = false;
  modulesMessage = '';
  modulesError = '';
  readonly moduleRows = [
    { key: 'hr', label: 'HR and attendance', hint: 'Staff records, attendance, leave, payroll, KPI ratings.' },
    { key: 'expenses', label: 'Expenses', hint: 'The expense ledger with approval.' },
    { key: 'payment_recon', label: 'Digital payment reconciliation', hint: 'Matching UPI / card takings to the provider statement.' },
    { key: 'stock_audits', label: 'Stock audits', hint: 'Planned cycle counts by category and store.' },
    { key: 'transfers', label: 'Stock transfers', hint: 'Moving stock between your stores.' },
    { key: 'gst', label: 'GST reconciliation', hint: 'Matching purchase invoices to GSTR-2A/2B. Needs purchasing.' },
  ];

  constructor(private http: HttpClient, private business: BusinessesService) {}

  private loadAdjustments() {
    this.business.getMine().subscribe((b: any) => { this.approvalMode = b.approvalmode || 'separate'; this.singlePerson = !!b.singleperson; }, () => {});
    this.business.getMyModules().subscribe((m: any) => { this.modules = m; this.hr = !!m.hr; }, () => this.modules = null);
  }

  saveApprovals() {
    this.approvalMessage = this.approvalError = '';
    this.approvalSaving = true;
    this.business.updateMine({ approvalmode: this.approvalMode }).subscribe(
      () => { this.approvalSaving = false; this.approvalMessage = 'Saved.'; },
      err => { this.approvalSaving = false; this.approvalError = this.msg(err, 'Could not save.'); });
  }

  /** a module the hosted plan leaves out cannot be switched on here */
  isLocked(key: string): boolean { return !!this.modules?.locked?.includes(key); }

  get lockedLabels(): string { return this.moduleRows.filter(m => this.isLocked(m.key)).map(m => m.label).join(', '); }

  /** Switching a module saves at once; the menus follow on the next screen change. */
  setModule(key: string, value: any) {
    this.modulesMessage = this.modulesError = '';
    this.modulesSaving = true;
    this.business.updateMyModules({ [key]: value }).subscribe(
      (m: any) => { this.modulesSaving = false; this.modules = m; this.modulesMessage = 'Saved. Menus update when you open the next screen.'; },
      err => { this.modulesSaving = false; this.modulesError = this.msg(err, 'Could not change the module.'); this.business.getMyModules().subscribe((m: any) => this.modules = m); });
  }

  ngOnInit(): void {
    this.http.get(`${this.api}/presets`).subscribe((r: any) => {
      this.presets = r.presets; this.stores = r.stores; this.current = r.current; this.locked = r.locked || []; this.loading = false;
      this.preset = r.current || "";
      this.shiftmode = r.stores.length && r.stores.every((s: any) => s.shiftmode === "staff") ? "staff" : "time";
      this.stores.forEach(s => this.perStore[s.id] = s.shiftmode);
      if (this.preset) this.refresh();
    }, err => { this.loading = false; this.error = this.msg(err, "Could not load the setup."); });
    this.loadAdjustments();
  }

  get planIsEmpty(): boolean { return !!this.plan && !this.plan.changes.length && !this.plan.stores.some((s: any) => s.changes.length); }
  get info(): any { return this.presets.find(p => p.key === this.preset) || null; }
  get asksShiftMode(): boolean { return !!this.preset && this.preset !== "solo"; }
  get perStoreMode(): boolean { return this.preset === "multi_store" && this.stores.length > 1; }

  private body(): any {
    const stores: any = {};
    if (this.perStoreMode) this.stores.forEach(s => stores[s.id] = { shiftmode: this.perStore[s.id] });
    return { preset: this.preset, shiftmode: this.shiftmode, stores, hr: this.preset === "owner_and_staff" ? this.hr : undefined };
  }

  choose(key: string) {
    this.preset = key; this.result = null;
    this.refresh();
  }

  refresh() {
    this.error = ""; this.plan = null;
    if (!this.preset) return;
    this.http.post(`${this.api}/preset/preview`, this.body()).subscribe((p: any) => this.plan = p, err => this.error = this.msg(err, "Could not work out the change."));
  }

  addLogin() { this.logins.push({ role: "Counter", fullname: "", email: "", password: "", storeid: this.stores[0]?.id || null }); }
  removeLogin(i: number) { this.logins.splice(i, 1); }

  apply() {
    this.busy = true; this.error = ""; this.result = null;
    // the one-person setup has one login and no one to add
    const accounts = this.preset === 'solo' ? [] : this.logins.filter(l => l.email || l.fullname).map(l => ({ role: l.role, fullname: l.fullname, email: l.email, password: l.password, storeids: l.storeid ? [Number(l.storeid)] : [] }));
    this.http.put(`${this.api}/preset`, { ...this.body(), accounts }).subscribe((r: any) => {
      this.busy = false; this.result = r; this.current = r.current; this.plan = null;
      this.logins = this.logins.filter((l, i) => r.accounts[i] && !r.accounts[i].ok);
      this.http.get(`${this.api}/presets`).subscribe((x: any) => this.stores = x.stores);
      this.loadAdjustments();
    }, err => { this.busy = false; this.error = this.msg(err, "Could not apply the setup."); });
  }

  private msg(err: any, fallback: string): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }
}

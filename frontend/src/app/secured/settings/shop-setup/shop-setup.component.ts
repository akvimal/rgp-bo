import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { BusinessesService } from "../businesses/businesses.service";
import { AuthService } from "src/app/@core/auth/auth.service";
import { PropsService } from "src/app/shared/props.service";
import { HrService } from "../../hr/hr.service";

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
  /** what kind of business this is: it decides which packs (a pharmacy's drug register, refills, words) the business has */
  businessType = 'pharmacy';
  typeSaving = false;
  typeMessage = '';
  typeError = '';
  readonly businessTypes = [
    { key: 'pharmacy', label: 'Pharmacy', hint: 'Medicines with schedules, prescriptions, the drug register and refill follow-up.' },
    { key: 'general', label: 'Other business', hint: 'Any other shop or service: no medicine fields, no drug register, no pharmacy words.' },
  ];
  modulesSaving = false;
  modulesMessage = '';
  modulesError = '';
  readonly moduleRows = [
    { key: 'hr', label: 'HR and attendance', hint: 'Staff records, attendance, leave, payroll, KPI ratings.' },
    { key: 'expenses', label: 'Expenses', hint: 'The expense ledger with approval.' },
    { key: 'payment_recon', label: 'Digital payment reconciliation', hint: 'Matching UPI / card takings to the provider statement.' },
    { key: 'stock_audits', label: 'Stock audits', hint: 'Planned cycle counts by category and store.' },
    { key: 'transfers', label: 'Stock transfers', hint: 'Moving stock between your stores.' },
    { key: 'returns', label: 'Sale returns', hint: 'Taking goods back from customers. Switch off if this business takes no returns; a store can also turn it off for itself under Settings > Store.' },
    { key: 'gst', label: 'GST reconciliation', hint: 'Matching purchase invoices to GSTR-2A/2B. Needs purchasing.' },
  ];

  // ---- HR and payroll: a starter pay structure, the year's holidays, and staff records for the logins that have none
  hrOffer: any = null;
  hrHolidays: any[] = [];
  hrPeople: any[] = [];
  hrNewHoliday: any = { date: '', name: '' };
  hrPicked: { [code: string]: boolean } = {};
  hrMessage = '';
  hrError = '';
  hrBusy = false;

  constructor(private http: HttpClient, private business: BusinessesService, private auth: AuthService, private props: PropsService, private hrApi: HrService) {}

  get hrOn(): boolean { return !!this.modules?.hr; }
  get hrStarterMissing(): number { return (this.hrOffer?.starter || []).filter((i: any) => !i.have).length; }
  get hrPickedCodes(): string[] { return Object.keys(this.hrPicked).filter(k => this.hrPicked[k]); }
  hrOf(kind: string): any[] { return (this.hrOffer?.starter || []).filter((i: any) => kind === 'PAY' ? i.kind !== 'LEAVE' : i.kind === 'LEAVE'); }
  hrSuggestions(kind: string): any[] { return (this.hrOffer?.suggestions || []).filter((i: any) => i.kind === kind); }
  get hrChecklist(): { label: string; done: boolean }[] {
    const p = this.hrOffer?.progress || {};
    return [
      { label: 'Pay components', done: p.components > 0 },
      { label: 'Leave types', done: p.leave_types > 0 },
      { label: 'Holidays for this year', done: p.holidays > 0 },
      { label: 'A salary for at least one person', done: p.paid_staff > 0 },
    ];
  }

  loadHr() {
    if (!this.hrOn) return;
    this.hrApi.get('starter').subscribe(r => this.hrOffer = r, () => this.hrOffer = null);
    this.hrApi.get('holidays', { year: new Date().getFullYear() }).subscribe(r => this.hrHolidays = r, () => {});
    this.hrApi.get('staff/candidates').subscribe(r => this.hrPeople = r.map((p: any) => ({ ...p, designation: '', position_id: p.suggested_position_id || null, join_date: this.hrApi.today() })), () => {});
    this.hrApi.get('positions').subscribe(r => this.hrPositions = (r || []).filter((p: any) => p.active), () => {});
  }

  /** the job roles on offer that the business does not have yet, and the ones it has */
  hrPositions: any[] = [];
  get hrRolesMissing(): any[] { return this.hrOffer?.roles || []; }

  hrAdd(starter: boolean, codes: string[], roles = false) {
    this.hrMessage = this.hrError = ''; this.hrBusy = true;
    this.hrApi.post('starter', { starter, codes, roles }).subscribe(
      (r: any) => { this.hrBusy = false; this.hrPicked = {}; const all = [...r.added, ...(r.roles || [])]; this.hrMessage = all.length ? `Added: ${all.join(', ')}.` : 'Nothing to add: you already have these.'; this.loadHr(); },
      err => { this.hrBusy = false; this.hrError = this.hrApi.msg(err); });
  }

  hrAddHoliday() {
    this.hrMessage = this.hrError = '';
    this.hrApi.post('holidays', this.hrNewHoliday).subscribe(
      () => { this.hrNewHoliday = { date: '', name: '' }; this.hrMessage = 'Holiday saved.'; this.loadHr(); },
      err => this.hrError = this.hrApi.msg(err));
  }

  hrRemoveHoliday(h: any) { this.hrApi.delete(`holidays/${h.date}`).subscribe(() => this.loadHr(), err => this.hrError = this.hrApi.msg(err)); }

  hrCreateStaff(p: any) {
    this.hrMessage = this.hrError = '';
    this.hrApi.post('staff', { user_id: p.id, designation: p.designation, position_id: p.position_id || null, join_date: p.join_date }).subscribe(
      () => { this.hrMessage = `${p.name} now has a staff record. Add the salary under HR > Staff.`; this.loadHr(); },
      err => this.hrError = this.hrApi.msg(err));
  }

  private loadAdjustments() {
    this.business.getMine().subscribe((b: any) => { this.approvalMode = b.approvalmode || 'separate'; this.singlePerson = !!b.singleperson; this.businessType = b.businesstype || 'pharmacy'; }, () => {});
    this.business.getMyModules().subscribe((m: any) => { this.modules = m; this.hr = !!m.hr; this.loadHr(); }, () => this.modules = null);
  }

  saveApprovals() {
    this.approvalMessage = this.approvalError = '';
    this.approvalSaving = true;
    this.business.updateMine({ approvalmode: this.approvalMode }).subscribe(
      () => { this.approvalSaving = false; this.approvalMessage = 'Saved.'; },
      err => { this.approvalSaving = false; this.approvalError = this.msg(err, 'Could not save.'); });
  }

  saveBusinessType() {
    this.typeMessage = this.typeError = '';
    this.typeSaving = true;
    this.business.updateMine({ businesstype: this.businessType }).subscribe(
      () => {
        this.props.refresh(() => {
          const c: any = this.props.config$.value || {};
          this.auth.setBusiness(c.businessType || this.businessType, c.packs || []);
          this.business.getMyModules().subscribe((m: any) => { this.modules = m; this.hr = !!m.hr; this.auth.setModules(m); }, () => {});
          this.typeSaving = false;
          this.typeMessage = 'Saved. Menus and words update when you open the next screen.';
        });
      },
      err => { this.typeSaving = false; this.typeError = this.msg(err, 'Could not change the business type.'); });
  }

  /** a module the hosted plan leaves out cannot be switched on here */
  isLocked(key: string): boolean { return !!this.modules?.locked?.includes(key); }

  get lockedLabels(): string { return this.moduleRows.filter(m => this.isLocked(m.key)).map(m => m.label).join(', '); }

  /** Switching a module saves at once; the menus follow on the next screen change. */
  setModule(key: string, value: any) {
    this.modulesMessage = this.modulesError = '';
    this.modulesSaving = true;
    this.business.updateMyModules({ [key]: value }).subscribe(
      (m: any) => { this.modulesSaving = false; this.modules = m; this.modulesMessage = 'Saved. Menus update when you open the next screen.'; this.loadHr(); },
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

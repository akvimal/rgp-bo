import { Component, HostListener, Injectable, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, CanDeactivate, Router } from "@angular/router";
import { forkJoin, Subscription } from "rxjs";
import { HrService } from "./hr.service";

/** The five areas of Setup, one tab each. The tab is kept in the address (?tab=holiday) so a link can open it. */
export const SETUP_TABS: { key: string; label: string }[] = [
  { key: "pay", label: "Pay" },
  { key: "position", label: "Job roles" },
  { key: "leave", label: "Leave" },
  { key: "holiday", label: "Holidays" },
  { key: "kpi", label: "KPI" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** What is open in the side panel: one item being added or changed, held as a copy so nothing on the page changes until Save. */
interface Panel { kind: "component" | "position" | "type" | "holiday" | "copy" | "measure"; title: string; model: any; snap: string; }

/**
 * Pay components, job roles, leave types, holidays, KPI measures and bands: everything that is configurable.
 * Lists are read-only; Add and Edit open a panel with one Save. The incentive bands are a table edited as a whole, with a save bar.
 */
@Component({ selector: "app-hr-setup", templateUrl: "./hr-setup.component.html" })
export class HrSetupComponent implements OnInit, OnDestroy {
  components: any[] = [];
  leaveTypes: any[] = [];
  holidays: any[] = [];
  holidayGroups: { month: string; items: any[] }[] = [];
  metrics: any[] = [];
  allBands: any[] = [];
  roles: string[] = [];
  systemMeasures: any[] = [];
  year = new Date().getFullYear();
  message = "";
  error = "";

  tabs = SETUP_TABS;
  tab = "pay";
  /** the word typed in the search box of the list on screen */
  q = "";

  /** job roles, each with the standard amount of every pay component; amounts are held by component id while editing */
  positions: any[] = [];

  panel: Panel | null = null;
  readonly saveIds: { [kind: string]: string } = { component: "hr-set-comp-save", position: "hr-pos-save", type: "hr-set-type-save", holiday: "hr-set-hol-save", copy: "hr-set-hol-copy-save", measure: "hr-set-metric-save" };
  readonly removeIds: { [kind: string]: string } = { component: "hr-set-comp-remove", position: "hr-pos-remove", type: "hr-set-type-remove" };
  /** an error from saving, shown in the panel so it is not hidden behind it */
  perr = "";
  busy = false;
  /** the holiday whose Remove is waiting for a yes */
  confirmHoliday = "";

  /** the measure being added or edited (the panel's model) */
  mf: any = null;
  /** which role's band set is on screen ("" = the default set) */
  bandRole = "";
  bands: any[] = [];
  /** the bands as last loaded or saved, to tell what has changed */
  private bandsSnap = "[]";
  /** the role the person asked for while the bands on screen had unsaved changes */
  bandPending: string | null = null;

  private sub?: Subscription;
  private msgTimer: any;

  constructor(private hr: HrService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.sub = this.route.queryParamMap.subscribe(p => {
      const t = p.get("tab");
      if (t && this.tabs.some(x => x.key === t)) this.tab = t;
    });
    this.hr.get("roles").subscribe(r => this.roles = r.map((x: any) => x.name));
    this.hr.get("kpi/system-measures").subscribe(r => this.systemMeasures = r);
    this.load();
  }

  ngOnDestroy() { this.sub?.unsubscribe(); clearTimeout(this.msgTimer); }

  go(key: string) {
    this.q = "";
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: key }, queryParamsHandling: "merge", replaceUrl: true });
  }

  tabCount(key: string): number {
    return { pay: this.components.length, position: this.positions.length, leave: this.leaveTypes.length, holiday: this.holidays.length, kpi: this.metrics.length }[key] ?? 0;
  }

  load() {
    this.hr.get("components").subscribe(r => { this.components = r; this.loadPositions(); });
    this.hr.get("leave/types").subscribe(r => { this.leaveTypes = r; this.syncLeaveNames(); });
    this.loadHolidays();
    this.hr.get("kpi/metrics").subscribe(r => this.metrics = r);
    // unsaved band changes stay on screen when something else on the page reloads the data
    this.hr.get("kpi/bands").subscribe(r => { this.allBands = r; if (!this.bandsDirty) this.showBands(); });
  }

  loadHolidays() {
    this.hr.get("holidays", { year: this.year }).subscribe(r => {
      this.holidays = r;
      const groups: { month: string; items: any[] }[] = [];
      for (const h of r) {
        const m = MONTHS[Number(String(h.date).slice(5, 7)) - 1] || "";
        const last = groups[groups.length - 1];
        if (last && last.month === m) last.items.push(h); else groups.push({ month: m, items: [h] });
      }
      this.holidayGroups = groups;
    });
  }

  setYear(y: number) { if (y > 1999 && y < 2200) { this.year = y; this.loadHolidays(); } }

  // ------------------------------------------------------------ search, shown on lists long enough to need it
  private hit(...vals: any[]): boolean {
    const q = this.q.trim().toLowerCase();
    return !q || vals.some(v => String(v ?? "").toLowerCase().includes(q));
  }
  get shownComponents(): any[] { return this.components.filter(c => this.hit(c.name, c.code)); }
  get shownPositions(): any[] { return this.positions.filter(p => this.hit(p.name, p.login_role)); }
  get shownTypes(): any[] { return this.leaveTypes.filter(t => this.hit(t.name)); }
  get shownMetrics(): any[] { return this.metrics.filter(m => this.hit(m.name, m.description)); }
  get shownHolidayGroups(): { month: string; items: any[] }[] {
    return this.holidayGroups.map(g => ({ month: g.month, items: g.items.filter(h => this.hit(h.name, h.date)) })).filter(g => g.items.length);
  }
  trackId(_: number, x: any) { return x.id; }

  // ------------------------------------------------------------ job roles, for the chips and the lists
  /** job role names for the chips, and back to ids for saving */
  get positionNames(): string[] { return this.positions.filter(p => p.active).map(p => p.name); }
  private namesToIds(names: string[] | null): number[] { return (names || []).map(n => this.positions.find(p => p.name === n)?.id).filter((x: any) => !!x); }
  private idsToNames(ids: number[] | null): string[] | null { const n = (ids || []).map(i => this.positions.find(p => p.id === i)?.name).filter((x: any) => !!x); return n.length ? n : null; }
  positionSummary(ids: number[] | null) { return ids?.length ? (this.idsToNames(ids) || []).join(", ") : "All job roles"; }

  /** the job role chips on a leave type use names; the server keeps ids */
  private syncLeaveNames() { for (const t of this.leaveTypes) t.position_names = this.idsToNames(t.applies_positions); }

  /** designations typed on staff records that could become job roles */
  designations: any[] = [];
  get pickedDesignations(): string[] { return this.designations.filter(g => g.pick).map(g => g.designation); }
  adoptDesignations() {
    this.hr.post("positions/designations", { designations: this.pickedDesignations }).subscribe(
      (r: any) => this.done(`${r.created.length} job role${r.created.length === 1 ? "" : "s"} created, ${r.assigned} staff given their job role. Open each to add its pay structure.`)(), this.fail());
  }

  /** the active pay components a structure can hold */
  get payComponents(): any[] { return this.components.filter(c => c.active); }

  loadPositions() {
    this.hr.get("positions").subscribe(r => { this.positions = r.map((p: any) => this.editable(p)); this.syncLeaveNames(); });
    this.hr.get("positions/designations").subscribe(r => this.designations = r.map((g: any) => ({ ...g, pick: false })), () => {});
  }

  private editable(p: any) {
    const amounts: any = {};
    for (const l of p.lines || []) amounts[l.component_id] = l.amount;
    return { id: p.id, name: p.name, active: p.active, staff: p.staff || 0, login_role: p.login_role || null, incentive_cap: p.incentive_cap ?? null, amounts };
  }

  private posBody(p: any) {
    return { name: p.name, active: p.active, login_role: p.login_role || null, incentive_cap: p.incentive_cap === "" || p.incentive_cap === undefined ? null : p.incentive_cap, lines: this.payComponents.map(c => ({ component_id: c.id, amount: p.amounts[c.id] })).filter(l => +l.amount > 0) };
  }

  /** earnings of a structure, for the one-line summary */
  posEarnings(p: any): number { return this.payComponents.filter(c => c.kind === "EARNING").reduce((t, c) => t + (+p.amounts[c.id] || 0), 0); }

  // ------------------------------------------------------------ the side panel
  private openPanel(kind: Panel["kind"], title: string, model: any) {
    this.perr = ""; this.error = ""; this.message = ""; this.busy = false;
    this.panel = { kind, title, model, snap: JSON.stringify(model) };
  }

  closePanel() { this.panel = null; this.mf = null; this.perr = ""; this.busy = false; }

  get panelDirty(): boolean { return !!this.panel && JSON.stringify(this.panel.model) !== this.panel.snap; }

  get panelCanSave(): boolean {
    const m = this.panel?.model;
    switch (this.panel?.kind) {
      case "holiday": return !!m.date && !!String(m.name || "").trim();
      case "copy": return m.rows.some((r: any) => r.pick && r.date && String(r.name || "").trim());
      default: return !!String(m?.name || "").trim();
    }
  }

  savePanel() {
    if (!this.panel) return;
    switch (this.panel.kind) {
      case "component": return this.saveComponent();
      case "position": return this.savePosition();
      case "type": return this.saveType();
      case "holiday": return this.saveHoliday();
      case "copy": return this.saveCopy();
      case "measure": return this.saveMeasure();
    }
  }

  removePanel() {
    switch (this.panel?.kind) {
      case "component": return this.removeComponent();
      case "position": return this.removePosition();
      case "type": return this.removeType();
    }
  }

  /** the panel's request finished: close it and say so */
  private saved(text: string) { return () => { this.closePanel(); this.done(text)(); }; }
  private done(text: string) {
    return () => {
      this.message = text; this.error = ""; this.load();
      clearTimeout(this.msgTimer);
      this.msgTimer = setTimeout(() => this.message = "", 6000);
    };
  }
  private fail() { return (e: any) => { this.busy = false; const t = this.hr.msg(e); if (this.panel) this.perr = t; else { this.error = t; this.message = ""; } }; }

  // ------------------------------------------------------------ pay components
  openComponent(c?: any) {
    this.openPanel("component", c ? "Edit pay component" : "New pay component",
      c ? { ...c, applies_roles: c.applies_roles ? [...c.applies_roles] : null } : { id: 0, name: "", kind: "EARNING", applies_roles: null, active: true });
  }
  private saveComponent() {
    const c = this.panel!.model; this.busy = true;
    const req = c.id ? this.hr.put(`components/${c.id}`, c) : this.hr.post("components", c);
    req.subscribe(this.saved(c.id ? "Component saved." : "Component added."), this.fail());
  }
  private removeComponent() {
    const c = this.panel!.model; this.busy = true;
    this.hr.delete(`components/${c.id}`).subscribe(r => this.saved(r.removed ? `${c.name} removed.` : `${c.name} is in the salary history, so it was made inactive instead.`)(), this.fail());
  }

  // ------------------------------------------------------------ job roles
  openPosition(p?: any) {
    this.openPanel("position", p ? "Edit job role" : "New job role",
      p ? { ...p, amounts: { ...p.amounts } } : { id: 0, name: "", active: true, login_role: null, incentive_cap: null, staff: 0, amounts: {} });
  }
  private savePosition() {
    const p = this.panel!.model; this.busy = true;
    const req = p.id ? this.hr.put(`positions/${p.id}`, this.posBody(p)) : this.hr.post("positions", this.posBody(p));
    req.subscribe(this.saved(p.id ? "Job role saved. Salaries already given are not changed." : "Job role added."), this.fail());
  }
  private removePosition() {
    const p = this.panel!.model; this.busy = true;
    this.hr.delete(`positions/${p.id}`).subscribe(r => this.saved(r.removed ? `${p.name} removed.` : `${p.name} is held by staff, so it was made inactive instead.`)(), this.fail());
  }

  // ------------------------------------------------------------ leave types
  openType(t?: any) {
    this.openPanel("type", t ? "Edit leave type" : "New leave type",
      t ? { ...t, applies_roles: t.applies_roles ? [...t.applies_roles] : null, position_names: t.position_names ? [...t.position_names] : null,
            advice_roles: t.advice_roles ? [...t.advice_roles] : null, advice_avoid_weekdays: t.advice_avoid_weekdays ? [...t.advice_avoid_weekdays] : [] }
        : { id: 0, name: "", paid: true, annual_days: 0, applies_roles: null, position_names: null, active: true, accrual_mode: "YEARLY", wait_months: 0, max_consecutive: null,
            stretch_counts_offs: true, advice_from_day: null, advice_to_day: null, advice_avoid_weekdays: [], advice_roles: null });
  }

  avoids(d: number): boolean { return (this.panel?.model?.advice_avoid_weekdays || []).includes(d); }
  toggleAvoid(d: number) {
    const a: number[] = this.panel!.model.advice_avoid_weekdays || (this.panel!.model.advice_avoid_weekdays = []);
    const i = a.indexOf(d);
    if (i >= 0) a.splice(i, 1); else a.push(d);
  }

  /** a leave type's rules in a line, for the list */
  rulesText(t: any): string {
    if (!t.paid) return "";
    const bits: string[] = [t.accrual_mode === "MONTHLY" ? "Builds up monthly" : "All at once"];
    if (t.wait_months > 0) bits.push(`after ${t.wait_months} month${t.wait_months === 1 ? "" : "s"} from joining`);
    if (t.max_consecutive) bits.push(`at most ${t.max_consecutive} day${t.max_consecutive === 1 ? "" : "s"} together`);
    if (t.advice_from_day && t.advice_to_day) bits.push(`advised ${t.advice_from_day}th-${t.advice_to_day}th`);
    if (t.advice_avoid_weekdays?.length) bits.push("advised not " + t.advice_avoid_weekdays.map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join("/"));
    return bits.join("; ");
  }
  private saveType() {
    const t = this.panel!.model; this.busy = true;
    const body = { ...t, applies_positions: this.namesToIds(t.position_names) };
    const req = t.id ? this.hr.put(`leave/types/${t.id}`, body) : this.hr.post("leave/types", body);
    req.subscribe(this.saved(t.id ? "Leave type saved." : "Leave type added."), this.fail());
  }
  private removeType() {
    const t = this.panel!.model; this.busy = true;
    this.hr.delete(`leave/types/${t.id}`).subscribe(r => this.saved(r.removed ? `${t.name} removed.` : `${t.name} has leave recorded against it, so it was made inactive instead.`)(), this.fail());
  }

  // ------------------------------------------------------------ holidays
  openHoliday(h?: any) {
    this.openPanel("holiday", h ? "Edit holiday" : "New holiday", h ? { date: String(h.date).slice(0, 10), name: h.name, isNew: false } : { date: "", name: "", isNew: true });
  }
  private saveHoliday() {
    const h = this.panel!.model; this.busy = true;
    this.hr.post("holidays", { date: h.date, name: h.name }).subscribe(this.saved("Holiday saved."), this.fail());
  }
  removeHoliday(h: any) {
    this.hr.delete(`holidays/${String(h.date).slice(0, 10)}`).subscribe(() => { this.confirmHoliday = ""; this.done("Holiday removed.")(); }, this.fail());
  }

  /** the same day in the year on screen; 29 February falls back to the 28th in a year without one */
  private sameDayIn(date: string, year: number): string {
    const md = String(date).slice(5, 10);
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return `${year}-${md === "02-29" && !leap ? "02-28" : md}`;
  }

  /** Offer last year's list for this year, each date open to change since festival dates move; days already listed start unticked. */
  openCopy() {
    this.hr.get("holidays", { year: this.year - 1 }).subscribe((prev: any[]) => {
      const have = new Set(this.holidays.map(h => String(h.date).slice(0, 10)));
      const rows = prev.map(h => { const date = this.sameDayIn(h.date, this.year); return { pick: !have.has(date), date, name: h.name, was: String(h.date).slice(0, 10) }; });
      this.openPanel("copy", `Copy the ${this.year - 1} list to ${this.year}`, { rows });
    }, this.fail());
  }
  get copyCount(): number { return this.panel?.kind === "copy" ? this.panel.model.rows.filter((r: any) => r.pick).length : 0; }
  private saveCopy() {
    const rows = this.panel!.model.rows.filter((r: any) => r.pick && r.date && String(r.name || "").trim());
    this.busy = true;
    forkJoin(rows.map((r: any) => this.hr.post("holidays", { date: r.date, name: r.name }))).subscribe(
      () => { this.year = Number(rows[0].date.slice(0, 4)) || this.year; this.saved(`${rows.length} holiday${rows.length === 1 ? "" : "s"} added.`)(); }, this.fail());
  }

  // ------------------------------------------------------------ KPI measures
  private blankMeasure() {
    return { id: 0, name: "", description: "", max_points: 10, source: "MANUAL", system_key: "", rule_kind: "steps", steps: [{ upto: 0, pct: 100 }, { upto: 2, pct: 60 }], otherwise: 0,
             target: null, floor: null, min_activity: 0, rating_scale: 5, applies_types: [], designations: "", applies_roles: null, position_names: null, active: true };
  }

  newMeasure() { this.mf = this.blankMeasure(); this.openPanel("measure", "New KPI measure", this.mf); }

  editMeasure(m: any) {
    const f = this.blankMeasure();
    Object.assign(f, {
      id: m.id, name: m.name, description: m.description || "", max_points: m.max_points, source: m.source, system_key: m.system_key || "",
      min_activity: m.min_activity || 0, rating_scale: m.rating_scale || 5, applies_types: m.applies_types || [],
      designations: (m.applies_designations || []).join(", "), applies_roles: m.applies_roles?.length ? m.applies_roles : null, position_names: this.idsToNames(m.applies_positions), active: m.active,
    });
    if (m.rule?.kind === "steps") Object.assign(f, { rule_kind: "steps", steps: m.rule.steps.map((s: any) => ({ ...s })), otherwise: m.rule.otherwise ?? 0 });
    if (m.rule?.kind === "linear") Object.assign(f, { rule_kind: "linear", target: m.rule.target, floor: m.rule.floor });
    this.mf = f;
    this.openPanel("measure", "Edit KPI measure", f);
  }

  get direction(): string { return this.systemMeasures.find(s => s.key === this.mf?.system_key)?.direction || ""; }
  get measureHint(): string { return this.systemMeasures.find(s => s.key === this.mf?.system_key)?.hint || ""; }
  get measureUnit(): string { return this.systemMeasures.find(s => s.key === this.mf?.system_key)?.unit || ""; }

  systemChanged() { this.mf.rule_kind = this.direction === "higher" ? "linear" : "steps"; }
  addStep() { const last = this.mf.steps[this.mf.steps.length - 1]; this.mf.steps = [...this.mf.steps, { upto: (last ? +last.upto : 0) + 1, pct: 0 }]; }
  removeStep(i: number) { this.mf.steps = this.mf.steps.filter((_: any, k: number) => k !== i); }
  toggleType(t: string) { const a: string[] = this.mf.applies_types; this.mf.applies_types = a.includes(t) ? a.filter(x => x !== t) : [...a, t]; }

  private saveMeasure() {
    const f = this.mf; this.busy = true;
    const body: any = {
      name: f.name, description: f.description, max_points: f.max_points, source: f.source, min_activity: f.min_activity, rating_scale: f.rating_scale,
      applies_types: f.applies_types, applies_roles: f.applies_roles || [], applies_positions: this.namesToIds(f.position_names), active: f.active,
      applies_designations: String(f.designations || "").split(",").map((x: string) => x.trim()).filter(Boolean),
    };
    if (f.source === "SYSTEM") {
      body.system_key = f.system_key;
      body.rule = f.rule_kind === "steps"
        ? { kind: "steps", steps: f.steps.map((s: any) => ({ upto: +s.upto, pct: +s.pct })), otherwise: +f.otherwise }
        : { kind: "linear", target: +f.target, floor: +f.floor };
    }
    const req = f.id ? this.hr.put(`kpi/metrics/${f.id}`, body) : this.hr.post("kpi/metrics", body);
    req.subscribe(this.saved("Measure saved."), this.fail());
  }

  roleSummary(r: string[] | null) { return r?.length ? r.join(", ") : "All roles"; }

  // ------------------------------------------------------------ bands, one set per role
  /** the band set on screen: "" the default, a login role's name, or "job:<id>" for a job role */
  private get bandJob(): number | null { return this.bandRole.startsWith("job:") ? Number(this.bandRole.slice(4)) : null; }
  private bandsOf(): any[] {
    const job = this.bandJob;
    return this.allBands.filter(b => job ? b.position_id === job : (!b.position_id && (b.role_name || "") === this.bandRole));
  }
  private snapOf(list: any[]): string { return JSON.stringify(list.map(b => [b.min_percent, b.label, b.incentive_percent, b.incentive_amount ?? null])); }
  showBands() { this.bands = this.bandsOf().map(b => ({ ...b })); this.bandsSnap = this.snapOf(this.bands); }
  get bandsDirty(): boolean { return this.snapOf(this.bands) !== this.bandsSnap; }
  get hasOwnBands(): boolean { return !this.bandRole || this.bandsOf().length > 0; }
  get bandLabel(): string { return this.bandJob ? (this.positions.find(p => p.id === this.bandJob)?.name || "this job role") : (this.bandRole || "the default set"); }
  addBand() { this.bands = [...this.bands, { min_percent: 0, label: "", incentive_percent: 0, incentive_amount: null }]; }
  removeBand(i: number) { this.bands = this.bands.filter((_, k) => k !== i); }

  /** choose another role's bands; with unsaved changes on screen, ask what to do with them first */
  pickBandRole(v: string, el?: HTMLSelectElement) {
    if (v === this.bandRole) return;
    if (this.bandsDirty) { this.bandPending = v; if (el) el.value = this.bandRole; return; }
    this.bandRole = v; this.showBands();
  }
  switchBands(save: boolean) {
    const v = this.bandPending; this.bandPending = null;
    if (v === null) return;
    if (save) this.saveBands(() => { this.bandRole = v; }); else { this.bandRole = v; this.showBands(); }
  }

  saveBands(then?: () => void) {
    const job = this.bandJob;
    const text = this.bandRole ? `Bands saved for ${this.bandLabel}.` : "Default bands saved.";
    this.hr.put("kpi/bands", { role_name: job ? null : (this.bandRole || null), position_id: job, bands: this.bands })
      .subscribe(() => { this.bandsSnap = this.snapOf(this.bands); if (then) then(); this.done(text)(); }, this.fail());
  }
  startOwnBands() { this.bands = this.allBands.filter(b => !b.role_name && !b.position_id).map(b => ({ min_percent: b.min_percent, label: b.label, incentive_percent: b.incentive_percent, incentive_amount: b.incentive_amount ?? null })); }

  // ------------------------------------------------------------ leaving with unsaved changes
  get hasUnsaved(): boolean { return this.bandsDirty || this.panelDirty; }

  @HostListener("window:beforeunload", ["$event"])
  onUnload(e: BeforeUnloadEvent) { if (this.hasUnsaved) { e.preventDefault(); e.returnValue = ""; } }
}

/** Asks before leaving Setup with edits not saved. */
@Injectable({ providedIn: "root" })
export class HrSetupLeaveGuard implements CanDeactivate<HrSetupComponent> {
  canDeactivate(c: HrSetupComponent): boolean {
    return !c.hasUnsaved || window.confirm("You have changes on this page that are not saved. Leave without saving them?");
  }
}

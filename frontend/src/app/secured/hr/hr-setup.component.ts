import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/** Pay components, leave types, holidays, KPI measures and bands: everything that is configurable. All of it except holidays can be limited to roles. */
@Component({ selector: "app-hr-setup", templateUrl: "./hr-setup.component.html" })
export class HrSetupComponent implements OnInit {
  components: any[] = [];
  leaveTypes: any[] = [];
  holidays: any[] = [];
  metrics: any[] = [];
  allBands: any[] = [];
  roles: string[] = [];
  systemMeasures: any[] = [];
  year = new Date().getFullYear();
  message = "";
  error = "";

  newComp: any = { name: "", kind: "EARNING", applies_roles: null };
  newType: any = { name: "", paid: true, annual_days: 0, applies_roles: null };
  newHoliday: any = { date: "", name: "" };

  /** job roles, each with the standard amount of every pay component; amounts are held by component id while editing */
  positions: any[] = [];
  newPos: any = { id: 0, name: "", active: true, amounts: {} };

  /** the measure being added or edited */
  mf: any = null;
  /** which role's band set is on screen ("" = the default set) */
  bandRole = "";
  bands: any[] = [];

  /** which sections are open; the first by default, and the choice is remembered in this browser */
  private open: { [key: string]: boolean } = { pay: true };

  constructor(private hr: HrService) {
    try {
      const saved = JSON.parse(localStorage.getItem("hr_setup_open") || "null");
      if (saved && typeof saved === "object") this.open = saved;
    } catch { /* storage blocked: the default stands */ }
  }

  isOpen(key: string): boolean { return !!this.open[key]; }

  toggle(key: string) { this.open = { ...this.open, [key]: !this.open[key] }; this.remember(); }

  setAll(on: boolean) { this.open = { pay: on, position: on, leave: on, kpi: on }; this.remember(); }

  private remember() { try { localStorage.setItem("hr_setup_open", JSON.stringify(this.open)); } catch { /* ignore */ } }


  ngOnInit() {
    this.hr.get("roles").subscribe(r => this.roles = r.map((x: any) => x.name));
    this.hr.get("kpi/system-measures").subscribe(r => this.systemMeasures = r);
    this.load();
  }

  load() {
    this.hr.get("components").subscribe(r => { this.components = r; this.loadPositions(); });
    this.hr.get("leave/types").subscribe(r => this.leaveTypes = r);
    this.hr.get("holidays", { year: this.year }).subscribe(r => this.holidays = r);
    this.hr.get("kpi/metrics").subscribe(r => this.metrics = r);
    this.hr.get("kpi/bands").subscribe(r => { this.allBands = r; this.showBands(); });
  }

  /** the active pay components a structure can hold */
  get payComponents(): any[] { return this.components.filter(c => c.active); }

  loadPositions() {
    this.hr.get("positions").subscribe(r => this.positions = r.map((p: any) => this.editable(p)));
  }

  private editable(p: any) {
    const amounts: any = {};
    for (const l of p.lines || []) amounts[l.component_id] = l.amount;
    return { id: p.id, name: p.name, active: p.active, staff: p.staff || 0, amounts };
  }

  private posBody(p: any) {
    return { name: p.name, active: p.active, lines: this.payComponents.map(c => ({ component_id: c.id, amount: p.amounts[c.id] })).filter(l => +l.amount > 0) };
  }

  /** earnings of a structure, for the one-line summary */
  posEarnings(p: any): number { return this.payComponents.filter(c => c.kind === "EARNING").reduce((t, c) => t + (+p.amounts[c.id] || 0), 0); }

  addPosition() {
    this.hr.post("positions", this.posBody(this.newPos)).subscribe(() => { this.newPos = { id: 0, name: "", active: true, amounts: {} }; this.done("Job role added.")(); }, this.fail());
  }
  savePosition(p: any) { this.hr.put(`positions/${p.id}`, this.posBody(p)).subscribe(this.done("Job role saved. Salaries already given are not changed."), this.fail()); }
  removePosition(p: any) {
    this.hr.delete(`positions/${p.id}`).subscribe(r => this.done(r.removed ? `${p.name} removed.` : `${p.name} is held by staff, so it was made inactive instead.`)(), this.fail());
  }

  private done(text: string) { return () => { this.message = text; this.error = ""; this.load(); }; }
  private fail() { return (e: any) => { this.error = this.hr.msg(e); this.message = ""; }; }

  addComponent() { this.hr.post("components", this.newComp).subscribe(() => { this.newComp = { name: "", kind: "EARNING", applies_roles: null }; this.done("Component added.")(); }, this.fail()); }
  saveComponent(c: any) { this.hr.put(`components/${c.id}`, c).subscribe(this.done("Component saved."), this.fail()); }
  removeComponent(c: any) {
    this.hr.delete(`components/${c.id}`).subscribe(r => this.done(r.removed ? `${c.name} removed.` : `${c.name} is in the salary history, so it was made inactive instead.`)(), this.fail());
  }

  addType() { this.hr.post("leave/types", this.newType).subscribe(() => { this.newType = { name: "", paid: true, annual_days: 0, applies_roles: null }; this.done("Leave type added.")(); }, this.fail()); }
  saveType(t: any) { this.hr.put(`leave/types/${t.id}`, t).subscribe(this.done("Leave type saved."), this.fail()); }
  removeType(t: any) {
    this.hr.delete(`leave/types/${t.id}`).subscribe(r => this.done(r.removed ? `${t.name} removed.` : `${t.name} has leave recorded against it, so it was made inactive instead.`)(), this.fail());
  }

  addHoliday() { this.hr.post("holidays", this.newHoliday).subscribe(() => { this.newHoliday = { date: "", name: "" }; this.done("Holiday saved.")(); }, this.fail()); }
  removeHoliday(h: any) { this.hr.delete(`holidays/${h.date}`).subscribe(this.done("Holiday removed."), this.fail()); }

  // ------------------------------------------------------------ KPI measures
  private blankMeasure() {
    return { id: 0, name: "", description: "", max_points: 10, source: "MANUAL", system_key: "", rule_kind: "steps", steps: [{ upto: 0, pct: 100 }, { upto: 2, pct: 60 }], otherwise: 0,
             target: null, floor: null, min_activity: 0, rating_scale: 5, applies_types: [], designations: "", applies_roles: null, active: true };
  }

  newMeasure() { this.mf = this.blankMeasure(); this.open = { ...this.open, kpi: true }; }

  editMeasure(m: any) {
    const f = this.blankMeasure();
    Object.assign(f, {
      id: m.id, name: m.name, description: m.description || "", max_points: m.max_points, source: m.source, system_key: m.system_key || "",
      min_activity: m.min_activity || 0, rating_scale: m.rating_scale || 5, applies_types: m.applies_types || [],
      designations: (m.applies_designations || []).join(", "), applies_roles: m.applies_roles?.length ? m.applies_roles : null, active: m.active,
    });
    if (m.rule?.kind === "steps") Object.assign(f, { rule_kind: "steps", steps: m.rule.steps.map((s: any) => ({ ...s })), otherwise: m.rule.otherwise ?? 0 });
    if (m.rule?.kind === "linear") Object.assign(f, { rule_kind: "linear", target: m.rule.target, floor: m.rule.floor });
    this.mf = f;
    this.open = { ...this.open, kpi: true };
  }

  get direction(): string { return this.systemMeasures.find(s => s.key === this.mf?.system_key)?.direction || ""; }
  get measureHint(): string { return this.systemMeasures.find(s => s.key === this.mf?.system_key)?.hint || ""; }
  get measureUnit(): string { return this.systemMeasures.find(s => s.key === this.mf?.system_key)?.unit || ""; }

  systemChanged() { this.mf.rule_kind = this.direction === "higher" ? "linear" : "steps"; }
  addStep() { const last = this.mf.steps[this.mf.steps.length - 1]; this.mf.steps = [...this.mf.steps, { upto: (last ? +last.upto : 0) + 1, pct: 0 }]; }
  removeStep(i: number) { this.mf.steps = this.mf.steps.filter((_: any, k: number) => k !== i); }
  toggleType(t: string) { const a: string[] = this.mf.applies_types; this.mf.applies_types = a.includes(t) ? a.filter(x => x !== t) : [...a, t]; }

  saveMeasure() {
    const f = this.mf;
    const body: any = {
      name: f.name, description: f.description, max_points: f.max_points, source: f.source, min_activity: f.min_activity, rating_scale: f.rating_scale,
      applies_types: f.applies_types, applies_roles: f.applies_roles || [], active: f.active,
      applies_designations: String(f.designations || "").split(",").map((x: string) => x.trim()).filter(Boolean),
    };
    if (f.source === "SYSTEM") {
      body.system_key = f.system_key;
      body.rule = f.rule_kind === "steps"
        ? { kind: "steps", steps: f.steps.map((s: any) => ({ upto: +s.upto, pct: +s.pct })), otherwise: +f.otherwise }
        : { kind: "linear", target: +f.target, floor: +f.floor };
    }
    const req = f.id ? this.hr.put(`kpi/metrics/${f.id}`, body) : this.hr.post("kpi/metrics", body);
    req.subscribe(() => { this.mf = null; this.done("Measure saved.")(); }, this.fail());
  }

  roleSummary(r: string[] | null) { return r?.length ? r.join(", ") : "All roles"; }

  // ------------------------------------------------------------ bands, one set per role
  showBands() { this.bands = this.allBands.filter(b => (b.role_name || "") === this.bandRole).map(b => ({ ...b })); }
  get hasOwnBands(): boolean { return !this.bandRole || this.allBands.some(b => b.role_name === this.bandRole); }
  addBand() { this.bands = [...this.bands, { min_percent: 0, label: "", incentive_percent: 0 }]; }
  removeBand(i: number) { this.bands = this.bands.filter((_, k) => k !== i); }
  saveBands() {
    this.hr.put("kpi/bands", { role_name: this.bandRole || null, bands: this.bands })
      .subscribe(this.done(this.bandRole ? `Bands saved for ${this.bandRole}.` : "Default bands saved."), this.fail());
  }
  startOwnBands() { this.bands = this.allBands.filter(b => !b.role_name).map(b => ({ min_percent: b.min_percent, label: b.label, incentive_percent: b.incentive_percent })); }
}

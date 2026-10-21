import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/** Pay components, leave types, holidays, KPI measures and bands: everything that is configurable. */
@Component({ selector: "app-hr-setup", templateUrl: "./hr-setup.component.html" })
export class HrSetupComponent implements OnInit {
  components: any[] = [];
  leaveTypes: any[] = [];
  holidays: any[] = [];
  metrics: any[] = [];
  bands: any[] = [];
  year = new Date().getFullYear();
  message = "";
  error = "";

  newComp: any = { name: "", kind: "EARNING" };
  newType: any = { name: "", paid: true, annual_days: 0 };
  newHoliday: any = { date: "", name: "" };
  newMetric: any = { name: "", max_points: 10, description: "" };

  constructor(private hr: HrService) {}

  ngOnInit() { this.load(); }

  load() {
    this.hr.get("components").subscribe(r => this.components = r);
    this.hr.get("leave/types").subscribe(r => this.leaveTypes = r);
    this.hr.get("holidays", { year: this.year }).subscribe(r => this.holidays = r);
    this.hr.get("kpi/metrics").subscribe(r => this.metrics = r);
    this.hr.get("kpi/bands").subscribe(r => this.bands = r);
  }

  private done(text: string) { return () => { this.message = text; this.error = ""; this.load(); }; }
  private fail() { return (e: any) => { this.error = this.hr.msg(e); this.message = ""; }; }

  addComponent() { this.hr.post("components", this.newComp).subscribe(() => { this.newComp = { name: "", kind: "EARNING" }; this.done("Component added.")(); }, this.fail()); }
  saveComponent(c: any) { this.hr.put(`components/${c.id}`, c).subscribe(this.done("Component saved."), this.fail()); }

  addType() { this.hr.post("leave/types", this.newType).subscribe(() => { this.newType = { name: "", paid: true, annual_days: 0 }; this.done("Leave type added.")(); }, this.fail()); }
  saveType(t: any) { this.hr.put(`leave/types/${t.id}`, t).subscribe(this.done("Leave type saved."), this.fail()); }

  addHoliday() { this.hr.post("holidays", this.newHoliday).subscribe(() => { this.newHoliday = { date: "", name: "" }; this.done("Holiday saved.")(); }, this.fail()); }
  removeHoliday(h: any) { this.hr.delete(`holidays/${h.date}`).subscribe(this.done("Holiday removed."), this.fail()); }

  addMetric() { this.hr.post("kpi/metrics", this.newMetric).subscribe(() => { this.newMetric = { name: "", max_points: 10, description: "" }; this.done("Measure added.")(); }, this.fail()); }
  saveMetric(m: any) { this.hr.put(`kpi/metrics/${m.id}`, m).subscribe(this.done("Measure saved."), this.fail()); }

  addBand() { this.bands = [...this.bands, { min_percent: 0, label: "", incentive_percent: 0 }]; }
  removeBand(i: number) { this.bands = this.bands.filter((_, k) => k !== i); }
  saveBands() { this.hr.put("kpi/bands", { bands: this.bands }).subscribe(this.done("Bands saved."), this.fail()); }
}

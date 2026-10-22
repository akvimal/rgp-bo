import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/**
 * Monthly KPI for the Business Head: system figures and managers' ratings turned into points, with the evidence shown.
 * Overrides need a reason; finalising freezes the month and payroll picks up the incentive.
 */
@Component({ selector: "app-hr-kpi", templateUrl: "./hr-kpi.component.html" })
export class HrKpiComponent implements OnInit {
  period = new Date().toISOString().slice(0, 7);
  rows: any[] = [];
  message = "";
  error = "";
  open: any = null;                 // the person whose breakdown is on screen
  ov: { [metricId: number]: { points: any; reason: string } } = {};

  constructor(private hr: HrService) {}

  ngOnInit() { this.load(); }

  load(keepOpen = false) {
    const id = keepOpen ? this.open?.employee_id : null;
    this.hr.get("kpi/month", { period: this.period }).subscribe(r => {
      this.rows = r;
      this.open = id ? r.find((x: any) => x.employee_id === id) || null : null;
      this.resetOverrides();
    }, e => this.error = this.hr.msg(e));
  }

  private resetOverrides() {
    this.ov = {};
    for (const i of this.open?.items || []) this.ov[i.metric_id] = { points: i.override_points, reason: i.override_reason || "" };
  }

  show(r: any) { this.message = this.error = ""; this.open = this.open?.employee_id === r.employee_id ? null : r; this.resetOverrides(); }

  percentOf(r: any) { return r.finalised ? r.percent : r.draft.percent; }
  bandOf(r: any) { return r.finalised ? r.band_label : r.draft.band_label; }
  incentiveOf(r: any) { return r.finalised ? r.incentive_percent : r.draft.incentive_percent; }

  stateText(i: any): string {
    if (i.state === "PENDING") return "Not rated yet";
    if (i.state === "NA") return i.na_reason || "Not applicable";
    return `${i.final_points} / ${i.max}`;
  }

  setOverride(i: any) {
    const o = this.ov[i.metric_id];
    this.hr.post("kpi/override", { employee_id: this.open.employee_id, period: this.period, metric_id: i.metric_id, points: o.points === "" ? null : o.points, reason: o.reason })
      .subscribe(() => { this.message = "Override saved."; this.error = ""; this.load(true); }, e => this.error = this.hr.msg(e));
  }

  clearOverride(i: any) {
    this.hr.post("kpi/override", { employee_id: this.open.employee_id, period: this.period, metric_id: i.metric_id, points: null })
      .subscribe(() => { this.message = "Override removed."; this.error = ""; this.load(true); }, e => this.error = this.hr.msg(e));
  }

  finalise(r: any | null, allowUnrated = false) {
    this.message = this.error = "";
    this.hr.post("kpi/finalise", { period: this.period, employee_id: r?.employee_id, allow_unrated: allowUnrated }).subscribe(res => {
      const skipped = (res.skipped || []).map((s: any) => `${s.name} (${s.reason})`).join("; ");
      this.message = `Finalised ${res.finalised}. ${skipped ? "Left out: " + skipped + "." : "Work payroll out again to pick up the incentive."}`;
      this.load(!!r);
    }, e => this.error = this.hr.msg(e));
  }

  reopen(r: any) {
    this.message = this.error = "";
    this.hr.post("kpi/reopen", { period: this.period, employee_id: r.employee_id }).subscribe(() => { this.message = "Reopened."; this.load(true); }, e => this.error = this.hr.msg(e));
  }
}

import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/** Monthly KPI scoring; the band a score falls in sets the incentive that payroll picks up. */
@Component({ selector: "app-hr-kpi", templateUrl: "./hr-kpi.component.html" })
export class HrKpiComponent implements OnInit {
  period = new Date().toISOString().slice(0, 7);
  rows: any[] = [];
  metrics: any[] = [];
  message = "";
  error = "";
  scoring: any = null;             // { employee_id, name, points: {metric_id: n}, note }

  constructor(private hr: HrService) {}

  ngOnInit() {
    this.hr.get("kpi/metrics").subscribe(m => this.metrics = m.filter((x: any) => x.active));
    this.load();
  }

  load() {
    this.scoring = null;
    this.hr.get("kpi/month", { period: this.period }).subscribe(r => this.rows = r, e => this.error = this.hr.msg(e));
  }

  start(r: any) {
    this.message = this.error = "";
    const points: any = {};
    for (const m of this.metrics) points[m.id] = r.scores?.find((s: any) => s.metric_id === m.id)?.points ?? null;
    this.scoring = { employee_id: r.employee_id, name: r.name, points, note: r.note || "", bills: r.bills, sales_value: r.sales_value };
  }

  save() {
    this.message = this.error = "";
    const scores = this.metrics.map(m => ({ metric_id: m.id, points: this.scoring.points[m.id] }));
    this.hr.post("kpi/score", { employee_id: this.scoring.employee_id, period: this.period, scores, note: this.scoring.note })
      .subscribe(r => { this.message = `Scored ${r.percent}%${r.band ? ' - ' + r.band : ''}${r.incentive_percent ? ', incentive ' + r.incentive_percent + '%' : ''}. Work payroll out again to pick it up.`; this.load(); }, e => this.error = this.hr.msg(e));
  }
}

import { Component, OnInit } from "@angular/core";
import { KpiApi } from "./kpi.service";
import { InsightsService } from "src/app/shared/insights.service";

/** A staff member's own finalised KPI: the score, the band, and the evidence behind each measure. */
@Component({
  selector: "app-kpi-mine",
  template: `
    <div class="pagetitle"><h1>My KPI</h1></div>
    <div class="card mb-3" *ngIf="notes.length" data-testid="kpi-coaching"><div class="card-body pt-3">
      <h5 class="card-title mb-2 p-0">Notes from your manager</h5>
      <div class="border rounded p-3 mb-2" *ngFor="let n of notes" data-testid="kpi-coaching-note" [attr.data-period]="n.period">
        <h6 class="mb-2">{{n.period}}</h6>
        <div class="row g-3">
          <div class="col-md-4" *ngIf="n.strengths.length"><div class="small fw-semibold text-success">What went well</div><ul class="small mb-0"><li *ngFor="let x of n.strengths">{{x}}</li></ul></div>
          <div class="col-md-4" *ngIf="n.focus.length"><div class="small fw-semibold">Where to focus</div><ul class="small mb-0"><li *ngFor="let x of n.focus">{{x}}</li></ul></div>
          <div class="col-md-4" *ngIf="n.tips.length"><div class="small fw-semibold">Something to try</div><ul class="small mb-0"><li *ngFor="let x of n.tips">{{x}}</li></ul></div>
        </div>
      </div>
    </div></div>
    <div class="card"><div class="card-body pt-3">
      <div *ngIf="loaded && !data.staff" class="text-muted" data-testid="kpi-nostaff">You do not have a staff record yet, so there is no KPI to show.</div>
      <div *ngIf="loaded && data.staff && !data.months.length" class="text-muted" data-testid="kpi-none">No month has been finalised for you yet.</div>
      <div *ngFor="let m of data.months" class="border rounded p-3 mb-3" data-testid="kpi-month" [attr.data-period]="m.period">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <h6 class="mb-2">{{m.period}}</h6>
          <div><span class="fs-5">{{m.percent}}%</span> <span class="badge bg-primary ms-1">{{m.band_label}}</span>
            <span class="small text-muted ms-2" *ngIf="m.incentive_amount !== null && m.incentive_amount !== undefined || m.incentive_percent">incentive {{m.incentive_amount !== null && m.incentive_amount !== undefined ? 'Rs ' + m.incentive_amount : m.incentive_percent + '%'}}</span></div>
        </div>
        <table class="table table-sm align-middle mb-0">
          <thead><tr><th>Measure</th><th>What was measured</th><th class="text-end">Points</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of m.scores">
              <td>{{s.name}}</td>
              <td class="small">{{s.source === 'SYSTEM' ? s.evidence : (s.rating !== null && s.rating !== undefined ? ('Rated ' + s.rating + ' of ' + s.scale) : '')}}
                <span class="text-muted" *ngIf="s.note"> - {{s.note}}</span><span class="text-warning" *ngIf="s.overridden"> (adjusted: {{s.override_reason}})</span></td>
              <td class="text-end">{{s.points}} / {{s.max}}</td>
            </tr>
          </tbody>
        </table>
        <div class="small text-muted mt-2" *ngIf="m.note">{{m.note}}</div>
      </div>
    </div></div>
  `,
})
export class KpiMineComponent implements OnInit {
  data: any = { staff: false, months: [] };
  loaded = false;

  notes: any[] = [];

  constructor(private api: KpiApi, private insights: InsightsService) {}

  ngOnInit() {
    this.api.mine().subscribe(d => { this.data = d; this.loaded = true; }, () => this.loaded = true);
    this.insights.myCoaching().subscribe(c => this.notes = c.notes || [], () => this.notes = []);
  }
}

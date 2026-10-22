import { Component, OnInit } from "@angular/core";
import { KpiApi } from "./kpi.service";

/** A staff member's own finalised KPI: the score, the band, and the evidence behind each measure. */
@Component({
  selector: "app-kpi-mine",
  template: `
    <div class="pagetitle"><h1>My KPI</h1></div>
    <div class="card"><div class="card-body pt-3">
      <div *ngIf="loaded && !data.staff" class="text-muted" data-testid="kpi-nostaff">You do not have a staff record yet, so there is no KPI to show.</div>
      <div *ngIf="loaded && data.staff && !data.months.length" class="text-muted" data-testid="kpi-none">No month has been finalised for you yet.</div>
      <div *ngFor="let m of data.months" class="border rounded p-3 mb-3" data-testid="kpi-month" [attr.data-period]="m.period">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <h6 class="mb-2">{{m.period}}</h6>
          <div><span class="fs-5">{{m.percent}}%</span> <span class="badge bg-primary ms-1">{{m.band_label}}</span>
            <span class="small text-muted ms-2" *ngIf="m.incentive_percent">incentive {{m.incentive_percent}}%</span></div>
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

  constructor(private api: KpiApi) {}

  ngOnInit() { this.api.mine().subscribe(d => { this.data = d; this.loaded = true; }, () => this.loaded = true); }
}

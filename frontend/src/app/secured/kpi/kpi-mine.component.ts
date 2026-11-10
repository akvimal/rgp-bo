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
    <div class="card mb-3" *ngIf="data.current" data-testid="kpi-setup"><div class="card-body pt-3">
      <h5 class="card-title mb-1 p-0">How your KPI is measured, {{data.current.period}}</h5>
      <div class="small text-muted mb-2" *ngIf="!data.current.items.length" data-testid="kpi-setup-empty">No KPI measures are set for your role yet. Ask your manager.</div>
      <div class="table-responsive" *ngIf="data.current.items.length">
        <table class="table table-sm align-middle mb-2" data-testid="kpi-setup-table">
          <thead><tr><th>Measure</th><th>How it earns points</th><th class="text-end">Points</th><th>So far this month</th></tr></thead>
          <tbody>
            <tr *ngFor="let i of data.current.items" data-testid="kpi-setup-row">
              <td>{{i.name}}<div class="small text-muted" *ngIf="i.description">{{i.description}}</div></td>
              <td class="small">{{ruleText(i)}}</td>
              <td class="text-end">{{i.max}}</td>
              <td class="small">
                <ng-container *ngIf="i.source === 'MANUAL'"><span class="text-muted">Rated by your manager at the month end</span></ng-container>
                <ng-container *ngIf="i.source !== 'MANUAL' && i.state === 'NA'"><span class="text-muted">{{i.na_reason || 'Not counted'}}</span></ng-container>
                <ng-container *ngIf="i.source !== 'MANUAL' && i.state !== 'NA'">{{i.evidence}} <span class="text-muted" *ngIf="i.points !== null && i.points !== undefined">({{i.points}} / {{i.max}})</span></ng-container>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="small mb-2" *ngIf="data.current.items.length && !data.current.finalised" data-testid="kpi-sofar">
        From the measures scored so far: <b>{{data.current.so_far.percent}}%</b><span *ngIf="data.current.so_far.band_label"> &middot; {{data.current.so_far.band_label}}</span>.
        <span class="text-muted">This changes as the month goes on, and manager ratings are added when the month is finalised.</span>
      </div>
      <div class="small mb-2 text-success" *ngIf="data.current.finalised">This month has been finalised: see it below.</div>
      <div *ngIf="data.current.bands.length" data-testid="kpi-bands">
        <div class="small fw-semibold">Bands</div>
        <table class="table table-sm w-auto mb-0"><tbody>
          <tr *ngFor="let b of data.current.bands"><td>{{b.label}}</td><td class="text-end">{{b.min}}% and above</td>
            <td class="text-end">{{b.incentive_amount !== null && b.incentive_amount !== undefined ? 'incentive Rs ' + b.incentive_amount : (b.incentive_percent ? 'incentive ' + b.incentive_percent + '%' : 'no incentive')}}</td></tr>
        </tbody></table>
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

  /** how a measure turns into points, in words (a target and a floor, or steps for a figure that should stay low) */
  ruleText(i: any): string {
    const r = i.rule, u = i.unit ? ' ' + i.unit : '';
    if (i.source === 'MANUAL') return 'Your manager rates it out of ' + (i.scale || 5) + '.';
    if (r?.kind === 'linear') return 'Full points at ' + r.target + u + ', none at ' + r.floor + u + ', in proportion between.';
    if (r?.kind === 'steps') {
      const parts = (r.steps || []).map((s: any) => 'up to ' + s.upto + u + ': ' + s.pct + '%');
      return parts.join('; ') + (r.otherwise !== undefined ? '; beyond: ' + r.otherwise + '%' : '') + '.';
    }
    return '';
  }

  ngOnInit() {
    this.api.mine().subscribe(d => { this.data = d; this.loaded = true; }, () => this.loaded = true);
    this.insights.myCoaching().subscribe(c => this.notes = c.notes || [], () => this.notes = []);
  }
}

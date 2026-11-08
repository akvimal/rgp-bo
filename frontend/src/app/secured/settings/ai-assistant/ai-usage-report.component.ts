import { Component, OnInit } from "@angular/core";
import { AlertsService } from "../../alerts/alerts.service";

/**
 * Settings > AI assistant: where the assistant is used. One row for every place in the app that asks a model for something (also those not used yet),
 * with this month's requests against last month, failures, how long a request takes, tokens and models, a count for each of the last 30 days, and the
 * use by model. Numbers only: no request or answer is ever kept.
 */
@Component({
  selector: "app2-ai-usage-report",
  template: `
    <div class="card mt-3" *ngIf="r" data-testid="aur-card">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
          <h5 class="card-title m-0 p-0">Where the assistant is used</h5>
          <button class="btn btn-sm btn-outline-secondary ms-auto" type="button" (click)="load()" data-testid="aur-refresh">Refresh</button>
        </div>
        <div class="small text-muted mb-3">Every place in the app that asks the model for something. Only counts are kept, never what was asked or answered.</div>

        <div class="row g-2 mb-3" data-testid="aur-tiles">
          <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">Requests this month</div><div class="fs-4 fw-bold" data-testid="aur-month">{{r.used}}</div><div class="small text-muted">{{r.limit ? 'of ' + r.limit + ' allowed' : 'no limit set'}}</div></div></div>
          <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">Worked</div><div class="fs-4 fw-bold" data-testid="aur-success">{{r.success_pct === null ? '-' : r.success_pct + '%'}}</div><div class="small text-muted">{{r.failed}} failed</div></div></div>
          <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">Average time</div><div class="fs-4 fw-bold">{{r.used ? secs(r.avg_ms) : '-'}}</div><div class="small text-muted">per request</div></div></div>
          <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="small text-muted">Tokens this month</div><div class="fs-4 fw-bold">{{r.input_tokens + r.output_tokens | number}}</div><div class="small text-muted">{{r.input_tokens | number}} in, {{r.output_tokens | number}} out</div></div></div>
        </div>

        <div class="table-responsive">
          <table class="table table-sm align-middle small mb-3" data-testid="aur-areas">
            <thead><tr><th>Where it is used</th><th class="text-end">This month</th><th class="text-end">Last month</th><th class="text-end">Failed</th><th class="text-end">Avg time</th><th class="text-end">Tokens in / out</th><th>Models</th><th>Last used</th></tr></thead>
            <tbody>
              <tr *ngFor="let a of r.areas" [attr.data-testid]="'aur-area-' + a.feature">
                <td>
                  <strong>{{a.label}}</strong>
                  <div class="text-muted">{{a.what}}</div>
                  <a *ngIf="a.route" [routerLink]="a.route" class="small">{{a.where}}</a><span *ngIf="!a.route && a.where" class="text-muted">{{a.where}}</span>
                </td>
                <td class="text-end fw-semibold" [attr.data-testid]="'aur-month-' + a.feature">{{a.month}}</td>
                <td class="text-end">{{a.last_month}}</td>
                <td class="text-end"><span *ngIf="a.failed" class="text-danger">{{a.failed}}<span *ngIf="a.failed_pct !== null"> ({{a.failed_pct}}%)</span></span><span *ngIf="!a.failed" class="text-muted">0</span></td>
                <td class="text-end">{{a.month ? secs(a.avg_ms) : '-'}}</td>
                <td class="text-end">{{a.input_tokens | number}} / {{a.output_tokens | number}}</td>
                <td><span *ngFor="let m of a.models" class="badge bg-light text-dark border me-1">{{m}}</span><span *ngIf="!a.models.length" class="text-muted">-</span></td>
                <td class="text-nowrap">{{a.last_used || 'never'}}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="fw-semibold small mb-1">Requests each day, last 30 days</div>
        <div class="d-flex align-items-end gap-1 mb-1" style="height:64px" data-testid="aur-daily" role="img" [attr.aria-label]="'Requests each day for the last 30 days, ' + r.used + ' this month'">
          <div *ngFor="let d of r.daily" class="flex-fill position-relative" style="min-width:3px;height:100%" [title]="d.day + ': ' + d.calls + ' request' + (d.calls === 1 ? '' : 's') + (d.failed ? ', ' + d.failed + ' failed' : '')">
            <div class="position-absolute bottom-0 start-0 end-0 rounded-top" [style.height.%]="barHeight(d.calls)" [style.minHeight.px]="d.calls ? 2 : 0" [style.background]="d.failed ? 'var(--bs-danger, #dc3545)' : 'var(--rgp-brand, #4154f1)'"></div>
          </div>
        </div>
        <div class="d-flex justify-content-between small text-muted mb-3"><span>{{r.daily[0]?.day}}</span><span>{{r.daily[r.daily.length - 1]?.day}}</span></div>

        <div *ngIf="r.by_model.length">
          <div class="fw-semibold small mb-1">By model, this month</div>
          <table class="table table-sm small mb-0" data-testid="aur-models">
            <thead><tr><th>Model</th><th class="text-end">Requests</th><th class="text-end">Failed</th><th class="text-end">Tokens in</th><th class="text-end">Tokens out</th></tr></thead>
            <tbody><tr *ngFor="let m of r.by_model"><td>{{m.model}}</td><td class="text-end">{{m.calls}}</td><td class="text-end">{{m.failed}}</td><td class="text-end">{{m.input_tokens | number}}</td><td class="text-end">{{m.output_tokens | number}}</td></tr></tbody>
          </table>
        </div>
        <div class="small text-muted" *ngIf="!r.used">No requests yet this month. Each draft an assistant makes counts as one request.</div>
      </div>
    </div>`,
})
export class AiUsageReportComponent implements OnInit {
  r: any = null;

  constructor(private alerts: AlertsService) {}

  ngOnInit() { this.load(); }

  load() { this.alerts.aiReport().subscribe((r) => (this.r = r), () => (this.r = null)); }

  secs(ms: number): string { return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`; }

  barHeight(calls: number): number {
    const max = Math.max(1, ...this.r.daily.map((d: any) => d.calls));
    return Math.round((calls / max) * 100);
  }
}

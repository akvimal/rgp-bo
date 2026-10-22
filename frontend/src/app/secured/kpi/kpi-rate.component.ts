import { Component, OnInit } from "@angular/core";
import { KpiApi } from "./kpi.service";

/** A manager rates the manual KPI measures of the staff of their stores for a month. */
@Component({
  selector: "app-kpi-rate",
  template: `
    <div class="pagetitle"><h1>Rate staff</h1></div>
    <div class="card"><div class="card-body pt-3">
      <div class="small text-muted mb-2">Rate each measure from 1 (poor) to the top of its scale (excellent). System measures are worked out for you and shown for context. The Business Head finalises the month.</div>
      <div class="mb-3"><label class="form-label">Month</label><input type="month" class="form-control" style="width:12rem" [(ngModel)]="period" (change)="load()" data-testid="kpi-period"></div>
      <div *ngIf="message" class="alert alert-success py-2" data-testid="kpi-message">{{message}}</div>
      <div *ngIf="error" class="alert alert-danger py-2" data-testid="kpi-error">{{error}}</div>

      <div *ngFor="let r of rows" class="border rounded p-3 mb-3" data-testid="kpi-person" [attr.data-emp]="r.employee_id">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <h6 class="mb-2">{{r.name}} <span class="small text-muted">{{r.designation}}</span></h6>
          <div class="small">
            <span class="badge bg-success" *ngIf="r.finalised">Finalised</span>
            <span class="badge bg-warning text-dark" *ngIf="!r.finalised && r.pending.length">{{r.pending.length}} to rate</span>
            <span class="ms-2 text-muted" *ngIf="r.items.length">{{r.percent}}%</span>
          </div>
        </div>
        <div class="small text-muted mb-2" *ngIf="r.self">You cannot rate yourself; the Business Head rates you.</div>
        <div class="small text-muted mb-2" *ngIf="r.finalised">This month is finalised. The Business Head can reopen it.</div>
        <table class="table table-sm align-middle mb-0" *ngIf="r.items.length">
          <tbody>
            <tr *ngFor="let i of r.items" data-testid="kpi-item" [attr.data-metric]="i.metric_id">
              <td style="width:30%">{{i.name}}<div class="small text-muted" *ngIf="i.description">{{i.description}}</div></td>
              <ng-container *ngIf="i.source === 'MANUAL'">
                <td style="width:20%">
                  <select class="form-select form-select-sm" [disabled]="r.locked || r.self" [ngModel]="i.rating" (ngModelChange)="save(r, i, $event, i.note)" [attr.data-testid]="'kpi-rating-' + i.metric_id">
                    <option [ngValue]="null">Not rated</option>
                    <option *ngFor="let n of scale(i)" [ngValue]="n">{{n}} of {{i.scale}}</option>
                  </select>
                </td>
                <td><input class="form-control form-control-sm" maxlength="200" placeholder="Note (optional)" [disabled]="r.locked || r.self" [(ngModel)]="i.note" (change)="save(r, i, i.rating, i.note)" [attr.data-testid]="'kpi-note-' + i.metric_id"></td>
              </ng-container>
              <ng-container *ngIf="i.source === 'SYSTEM'">
                <td colspan="2" class="small text-muted">Measured by the system: {{i.state === 'SCORED' ? (i.evidence + ' (' + i.final_points + ' of ' + i.max + ' points)') : i.na_reason}}</td>
              </ng-container>
            </tr>
          </tbody>
        </table>
        <div class="small text-muted" *ngIf="!r.items.length">No KPI measures apply to this person.</div>
      </div>
      <div *ngIf="!rows.length" class="text-muted text-center py-3">No staff of your stores in that month.</div>
    </div></div>
  `,
})
export class KpiRateComponent implements OnInit {
  period = new Date().toISOString().slice(0, 7);
  rows: any[] = [];
  message = "";
  error = "";

  constructor(private api: KpiApi) {}

  ngOnInit() { this.load(); }

  load() { this.api.month(this.period).subscribe(r => this.rows = r, e => this.error = this.api.msg(e)); }

  scale(i: any): number[] { return Array.from({ length: i.scale }, (_, k) => k + 1); }

  save(r: any, i: any, rating: any, note: string) {
    this.message = this.error = "";
    this.api.rate({ employee_id: r.employee_id, period: this.period, metric_id: i.metric_id, rating, note }).subscribe(
      () => { this.message = `${r.name}: ${i.name} saved.`; this.load(); },
      e => { this.error = this.api.msg(e); this.load(); });
  }
}

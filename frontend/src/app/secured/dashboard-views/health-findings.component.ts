import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/**
 * The health card: status from the worst finding (not an average), the findings by severity, the five to put right first, and (for the owner) every
 * store by area. See docs/planning/DASHBOARD_FINANCE_HEALTH.md section 4. The server works the findings out and scopes them to the person's stores.
 */
@Component({
    selector: 'app-health-findings',
    styles: [`
      :host { display: block; }
      .sev { font-size: .72rem; text-transform: uppercase; letter-spacing: .02em; min-width: 4.2rem; display: inline-block; text-align: center; }
      .cell { width: 2.2rem; height: 1.4rem; border-radius: .25rem; display: inline-block; vertical-align: middle; }
      .sev-critical { background: #c92a2a; color: #fff; } .sev-major { background: #f59f00; color: #212529; } .sev-minor { background: #74c0fc; color: #0b3a66; } .sev-info { background: #ced4da; color: #343a40; } .sev-none { background: #d3f9d8; color: #2b8a3e; }
      .bar { height: 6px; }
    `],
    template: `
    <section class="card mb-3" aria-label="Health" data-testid="findings-card">
      <div class="card-body">
        <div class="small text-danger" *ngIf="error">{{error}}</div>
        <div *ngIf="!data && !error" class="text-muted small">Checking the store...</div>
        <ng-container *ngIf="data">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <h2 class="h6 mb-1">Health <span class="text-muted fw-normal small">the worst open finding sets the status</span></h2>
              <div class="d-flex align-items-baseline gap-2" *ngIf="data.score !== null">
                <span class="display-6 fw-bold" data-testid="findings-score">{{data.score}}</span>
                <span class="badge" [ngClass]="statusClass" data-testid="findings-status">{{statusText}}</span>
              </div>
              <div class="d-flex flex-wrap gap-2 mt-1 small" data-testid="findings-counts">
                <span class="badge sev-critical">{{data.counts.critical}} critical</span>
                <span class="badge sev-major">{{data.counts.major}} major</span>
                <span class="badge sev-minor">{{data.counts.minor}} minor</span>
                <span class="text-muted align-self-center" *ngIf="data.newThisWeek">{{data.newThisWeek}} new in the last 7 days</span>
              </div>
            </div>
            <div *ngIf="trendPoints" class="text-end" aria-label="Score over the last 12 weeks" data-testid="findings-trend">
              <svg viewBox="0 0 160 40" width="160" height="40" role="img" [attr.aria-label]="'Score over time, now ' + data.score"><polyline fill="none" stroke="#1c7ed6" stroke-width="2" [attr.points]="trendPoints"></polyline></svg>
              <div class="small text-muted">last {{data.trend.length}} days recorded</div>
            </div>
          </div>

          <div class="row g-2 mt-2" data-testid="findings-areas">
            <div class="col-6 col-md-4 col-xl-3" *ngFor="let a of data.areas">
              <div class="d-flex justify-content-between small"><span>{{a.label}}</span><strong>{{a.score}}</strong></div>
              <div class="progress bar"><div class="progress-bar" [ngClass]="areaBar(a)" [style.width.%]="a.score" role="progressbar" [attr.aria-valuenow]="a.score" aria-valuemin="0" aria-valuemax="100"></div></div>
              <div class="small text-muted">{{areaWords(a)}}</div>
            </div>
          </div>

          <div class="mt-3" data-testid="findings-fix-first">
            <h3 class="h6">Fix first</h3>
            <div class="text-success small" *ngIf="!data.fixFirst.length">Nothing needs fixing. No critical, major or minor findings are open.</div>
            <div class="border rounded p-2 mb-2" *ngFor="let f of data.fixFirst" [attr.data-testid]="'fix-' + f.code">
              <ng-container *ngTemplateOutlet="row; context: { f: f, recovers: f.recovers }"></ng-container>
            </div>
          </div>

          <div class="mt-2">
            <button class="btn btn-sm btn-link px-0" (click)="showAll = !showAll" data-testid="findings-toggle">{{showAll ? 'Hide' : 'Show'}} all {{data.findings.length}} findings</button>
            <ng-container *ngIf="showAll">
              <div class="d-flex flex-wrap gap-2 align-items-center my-2 small">
                <label>Severity <select class="form-select form-select-sm d-inline-block w-auto" [(ngModel)]="sevFilter" data-testid="findings-sev"><option value="">All</option><option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option><option value="info">Info</option></select></label>
                <label>Area <select class="form-select form-select-sm d-inline-block w-auto" [(ngModel)]="areaFilter"><option value="">All</option><option *ngFor="let a of data.areas" [value]="a.key">{{a.label}}</option></select></label>
              </div>
              <div class="border rounded p-2 mb-2" *ngFor="let f of filtered" [attr.data-testid]="'finding-' + f.code">
                <ng-container *ngTemplateOutlet="row; context: { f: f, recovers: null }"></ng-container>
              </div>
              <div class="text-muted small" *ngIf="!filtered.length">Nothing matches.</div>
            </ng-container>
          </div>

          <div class="mt-3" *ngIf="data.snoozed.length" data-testid="findings-snoozed">
            <h3 class="h6">Set aside ({{data.snoozed.length}})</h3>
            <div class="d-flex flex-wrap justify-content-between small border-bottom py-1" *ngFor="let f of data.snoozed">
              <span><strong>{{f.title}}</strong> <span class="text-muted">until {{f.snoozedUntil}}: {{f.snoozeReason}}</span></span>
              <button class="btn btn-sm btn-link py-0" *ngIf="canSnooze" (click)="bringBack(f)">Bring back</button>
            </div>
          </div>

          <div class="mt-3" *ngIf="data.matrix?.length" data-testid="findings-matrix">
            <h3 class="h6">Every store, by area <span class="text-muted fw-normal small">the worst open finding in each cell</span></h3>
            <div class="table-responsive"><table class="table table-sm align-middle">
              <thead><tr><th>Store</th><th class="text-end">Score</th><th *ngFor="let a of data.areas" class="text-center small">{{a.label}}</th></tr></thead>
              <tbody><tr *ngFor="let r of data.matrix"><td>{{r.name}}</td><td class="text-end">{{r.score}}</td>
                <td *ngFor="let a of data.areas" class="text-center"><span class="cell" [ngClass]="'sev-' + (r.cells[a.key] || 'none')" [attr.title]="r.cells[a.key] || 'clear'"></span><span class="visually-hidden">{{r.cells[a.key] || 'clear'}}</span></td></tr></tbody>
            </table></div>
            <div class="small text-muted">Red critical, amber major, blue minor, green clear. Findings that belong to the whole business, not to a store, are not in a row.</div>
          </div>
          <div class="small text-muted mt-2">Updated {{data.asOf | date:'shortTime'}}. A minor finding left open for 14 days counts as major. Legal and statutory items cannot be set aside.</div>
        </ng-container>
      </div>
    </section>

    <ng-template #row let-f="f" let-recovers="recovers">
      <div class="d-flex flex-wrap justify-content-between gap-2">
        <div class="flex-grow-1" style="min-width: 14rem">
          <span class="badge sev me-2" [ngClass]="'sev-' + f.severity">{{f.severity}}</span>
          <strong>{{f.title}}</strong>
          <span class="badge bg-light text-dark border ms-1" *ngIf="f.aged" title="Open for 14 days or more">aged to major</span>
          <span class="badge bg-light text-dark border ms-1" *ngIf="f.legal">legal duty</span>
          <div class="small">{{f.detail}}</div>
          <div class="small text-muted">
            {{areaLabel(f.area)}}<span *ngIf="f.store"> &middot; {{f.store}}</span> &middot; owner: {{f.owner}}
            <span *ngIf="f.daysOpen > 0"> &middot; open {{f.daysOpen}} day{{f.daysOpen === 1 ? '' : 's'}}</span>
            <span *ngIf="f.amount"> &middot; &#8377;{{f.amount | number:'1.0-0'}} at stake</span>
            <span *ngIf="recovers"> &middot; fixing it adds {{recovers}} point{{recovers === 1 ? '' : 's'}}</span>
          </div>
        </div>
        <div class="d-flex gap-1 align-items-start">
          <a class="btn btn-sm btn-outline-primary" [routerLink]="f.link">Open</a>
          <button class="btn btn-sm btn-outline-secondary" *ngIf="canSnooze && !f.legal" (click)="startSnooze(f)">Set aside</button>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center mt-2" *ngIf="snoozing === f.key">
        <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="snoozeUntil" [min]="tomorrow" aria-label="Set aside until" data-testid="snooze-until">
        <input type="text" class="form-control form-control-sm w-auto" style="min-width: 16rem" [(ngModel)]="snoozeReason" maxlength="300" placeholder="Why can this wait?" aria-label="Why can this wait" data-testid="snooze-reason">
        <button class="btn btn-sm btn-primary" (click)="saveSnooze(f)" data-testid="snooze-save">Set aside</button>
        <button class="btn btn-sm btn-link" (click)="snoozing = ''">Cancel</button>
        <span class="text-danger small" *ngIf="snoozeError">{{snoozeError}}</span>
      </div>
    </ng-template>`
})
export class HealthFindingsComponent implements OnChanges {
    @Input() storeid: number | null = null;
    /** the owner may set a finding aside; nobody sets a legal one aside */
    @Input() canSnooze = false;

    data: any = null;
    error = '';
    showAll = false;
    sevFilter = '';
    areaFilter = '';
    snoozing = '';
    snoozeUntil = '';
    snoozeReason = '';
    snoozeError = '';

    constructor(private dashboard: DashboardService) {}

    ngOnChanges(c: SimpleChanges) { if (c.storeid || !this.data) this.load(); }

    load() {
        this.dashboard.getFindings(this.storeid).subscribe({
            next: (d: any) => { this.data = d; this.error = ''; },
            error: (e) => (this.error = e?.error?.message || 'Health could not be loaded.')
        });
    }

    get tomorrow(): string { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }
    get statusText(): string { return this.data?.status === 'healthy' ? 'Healthy' : this.data?.status === 'notes' ? 'Healthy, with notes' : this.data?.status === 'watch' ? 'Watch' : this.data?.status === 'act' ? 'Act now' : ''; }
    get statusClass(): string { return this.data?.status === 'healthy' || this.data?.status === 'notes' ? 'bg-success' : this.data?.status === 'watch' ? 'bg-warning text-dark' : 'bg-danger'; }
    get filtered(): any[] { return (this.data?.findings || []).filter((f: any) => (!this.sevFilter || f.severity === this.sevFilter) && (!this.areaFilter || f.area === this.areaFilter)); }

    /** the score over the days recorded, as the points of a small line (needs two days to draw) */
    get trendPoints(): string {
        const t: any[] = this.data?.trend || [];
        if (t.length < 2) return '';
        return t.map((p, i) => `${Math.round((i / (t.length - 1)) * 158) + 1},${Math.round(38 - (Math.max(0, Math.min(100, p.score)) / 100) * 36)}`).join(' ');
    }

    areaLabel(key: string): string { return (this.data?.areas || []).find((a: any) => a.key === key)?.label || key; }
    areaBar(a: any): string { return a.worst === 'critical' ? 'bg-danger' : a.worst === 'major' ? 'bg-warning' : a.worst === 'minor' ? 'bg-info' : 'bg-success'; }
    areaWords(a: any): string {
        const bits = [a.critical ? `${a.critical} critical` : '', a.major ? `${a.major} major` : '', a.minor ? `${a.minor} minor` : ''].filter(Boolean);
        return bits.length ? bits.join(', ') : 'clear';
    }

    startSnooze(f: any) { this.snoozing = f.key; this.snoozeUntil = ''; this.snoozeReason = ''; this.snoozeError = ''; }
    saveSnooze(f: any) {
        this.snoozeError = '';
        this.dashboard.snoozeFinding({ key: f.key, until: this.snoozeUntil, reason: this.snoozeReason }).subscribe({
            next: () => { this.snoozing = ''; this.load(); },
            error: (e) => (this.snoozeError = e?.error?.message || 'It could not be set aside.')
        });
    }
    bringBack(f: any) { this.dashboard.unsnoozeFinding(f.key).subscribe({ next: () => this.load(), error: (e) => (this.error = e?.error?.message || 'It could not be brought back.') }); }
}

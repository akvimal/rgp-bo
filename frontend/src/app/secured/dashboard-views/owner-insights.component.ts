import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/**
 * Store health and the interactive charts of the Owner and Manager views (DASHBOARD_AND_MENU_DESIGN 5, implementation plan stage 6).
 * The server decides what the person may see (every figure is scoped to their stores); each chart loads on its own and fails on its own.
 * Every chart can be shown as a table, which is also its text alternative.
 */
@Component({
    selector: 'app-owner-insights',
    template: `
    <section class="card mb-3" aria-label="Store health" data-testid="health-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h2 class="h6 mb-1">Store health <span class="text-muted fw-normal small">seven checks, weighted by your settings</span></h2>
            <div *ngIf="health && health.score !== null" class="d-flex align-items-baseline gap-2">
              <span class="display-6 fw-bold" data-testid="health-score">{{health.score}}</span>
              <span class="badge" [ngClass]="statusClass" data-testid="health-status">{{statusText}}</span>
            </div>
            <div class="small text-warning" *ngIf="health?.held" data-testid="health-held">The total is high, but one check is weak, so the store stays at Watch until it is put right.</div>
            <div class="small text-muted" *ngIf="health && health.score === null">Nothing to judge yet.</div>
            <div class="small text-danger" *ngIf="healthError">{{healthError}}</div>
          </div>
          <div class="text-end small" *ngIf="canSetTargets">
            <div class="text-muted">Sales target for {{monthLabel}}</div>
            <div class="input-group input-group-sm" style="max-width: 15rem">
              <span class="input-group-text">₹</span>
              <input type="number" min="0" class="form-control" [(ngModel)]="targetInput" aria-label="Sales target for the month" data-testid="target-input" placeholder="Not set">
              <button class="btn btn-outline-primary" (click)="saveTarget()" [disabled]="savingTarget" data-testid="target-save">Save</button>
            </div>
            <div class="text-success" *ngIf="targetSaved" role="status">Saved.</div>
            <div class="text-danger" *ngIf="targetError">{{targetError}}</div>
          </div>
        </div>
        <div class="row g-2 mt-2" *ngIf="health">
          <div class="col-md-6 col-xl-4" *ngFor="let c of health.checks" [attr.data-testid]="'health-check-' + c.key">
            <div class="d-flex justify-content-between small"><span>{{c.label}}</span><strong>{{c.score === null ? 'no data' : c.score}}</strong></div>
            <div class="progress" style="height: 6px" *ngIf="c.score !== null"><div class="progress-bar" [ngClass]="barClass(c.score)" [style.width.%]="c.score" role="progressbar" [attr.aria-valuenow]="c.score" aria-valuemin="0" aria-valuemax="100"></div></div>
            <div class="small text-muted">{{c.fact}}</div>
          </div>
        </div>
      </div>
    </section>

    <div class="row g-3 mb-3">
      <div class="col-xl-8">
        <section class="card h-100" aria-label="Sales by month" data-testid="chart-sales-months">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">Sales by month <span class="text-muted fw-normal small">against the same months of the last two years</span></h2>
              <button class="btn btn-sm btn-link" (click)="tables.sales = !tables.sales">{{tables.sales ? 'Show chart' : 'Show numbers'}}</button></div>
            <ngx-charts-line-chart *ngIf="!tables.sales && salesSeries.length" [view]="[0, 280]" [results]="salesSeries" [xAxis]="true" [yAxis]="true" [legend]="true" [legendPosition]="below" [showXAxisLabel]="false" [showYAxisLabel]="false" [autoScale]="true" [scheme]="lineScheme" (select)="pickMonth($event)"></ngx-charts-line-chart>
            <div class="table-responsive" *ngIf="tables.sales"><table class="table table-sm"><thead><tr><th>Month</th><th class="text-end">Sales</th><th class="text-end">Last year</th><th class="text-end">Two years ago</th></tr></thead>
              <tbody><tr *ngFor="let m of salesMonths"><td>{{m.month}}</td><td class="text-end">{{m.sales | number:'1.0-0'}}</td><td class="text-end">{{m.lastYear | number:'1.0-0'}}</td><td class="text-end">{{m.twoYearsAgo | number:'1.0-0'}}</td></tr></tbody></table></div>
            <div class="small text-muted" *ngIf="err.sales">{{err.sales}}</div>
          </div>
        </section>
      </div>
      <div class="col-xl-4">
        <section class="card h-100" aria-label="Sales by category" data-testid="chart-categories">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">Sales by category <span class="text-muted fw-normal small">{{categories?.month}}</span></h2>
              <button class="btn btn-sm btn-link" (click)="tables.cat = !tables.cat">{{tables.cat ? 'Show chart' : 'Show numbers'}}</button></div>
            <ngx-charts-bar-horizontal *ngIf="!tables.cat && catBars.length" [view]="[0, 280]" [results]="catBars" [xAxis]="true" [yAxis]="true" [scheme]="barScheme"></ngx-charts-bar-horizontal>
            <div class="table-responsive" *ngIf="tables.cat"><table class="table table-sm"><thead><tr><th>Category</th><th class="text-end">Sales</th><th class="text-end">Share</th></tr></thead>
              <tbody><tr *ngFor="let c of categories?.categories"><td>{{c.category}}</td><td class="text-end">{{c.total | number:'1.0-0'}}</td><td class="text-end">{{c.share}}%</td></tr></tbody></table></div>
            <div class="small text-muted" *ngIf="err.cat">{{err.cat}}</div>
          </div>
        </section>
      </div>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-xl-6">
        <section class="card h-100" aria-label="Customers" data-testid="chart-customers">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">New and returning customers <span class="text-muted fw-normal small">counts only, by month</span></h2>
              <button class="btn btn-sm btn-link" (click)="tables.cust = !tables.cust">{{tables.cust ? 'Show chart' : 'Show numbers'}}</button></div>
            <ngx-charts-bar-vertical-stacked *ngIf="!tables.cust && custSeries.length" [view]="[0, 260]" [results]="custSeries" [xAxis]="true" [yAxis]="true" [legend]="true" [legendPosition]="below" [scheme]="custScheme"></ngx-charts-bar-vertical-stacked>
            <div class="table-responsive" *ngIf="tables.cust"><table class="table table-sm"><thead><tr><th>Month</th><th class="text-end">New</th><th class="text-end">Returning</th><th class="text-end">Repeat rate</th></tr></thead>
              <tbody><tr *ngFor="let m of customers"><td>{{m.month}}</td><td class="text-end">{{m.new}}</td><td class="text-end">{{m.returning}}</td><td class="text-end">{{m.repeatRate}}%</td></tr></tbody></table></div>
            <div class="small text-muted" *ngIf="err.cust">{{err.cust}}</div>
          </div>
        </section>
      </div>
      <div class="col-xl-6" *ngIf="canSeePayables">
        <section class="card h-100" aria-label="What we owe" data-testid="chart-payables">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">What we owe vendors <span class="text-muted fw-normal small">by how late it is</span></h2>
              <button class="btn btn-sm btn-link" (click)="tables.pay = !tables.pay">{{tables.pay ? 'Show chart' : 'Show numbers'}}</button></div>
            <ngx-charts-bar-vertical *ngIf="!tables.pay && payBars.length" [view]="[0, 260]" [results]="payBars" [xAxis]="true" [yAxis]="true" [scheme]="barScheme"></ngx-charts-bar-vertical>
            <div class="table-responsive" *ngIf="tables.pay"><table class="table table-sm"><thead><tr><th>When</th><th class="text-end">Invoices</th><th class="text-end">Amount</th></tr></thead>
              <tbody><tr *ngFor="let b of payables?.buckets"><td>{{b.label}}</td><td class="text-end">{{b.count}}</td><td class="text-end">{{b.total | number:'1.0-0'}}</td></tr></tbody></table></div>
            <div class="small text-muted">Total owed ₹{{(payables?.total || 0) | number:'1.0-0'}} &middot; <a routerLink="/secure/purchases">open the invoices</a></div>
            <div class="small text-muted" *ngIf="err.pay">{{err.pay}}</div>
          </div>
        </section>
      </div>
    </div>

    <section class="card mb-3" aria-label="Busy hours" data-testid="chart-hours">
      <div class="card-body">
        <div class="d-flex justify-content-between"><h2 class="h6">When are we busy <span class="text-muted fw-normal small">bills by weekday and hour, last 90 days</span></h2>
          <button class="btn btn-sm btn-link" (click)="tables.hours = !tables.hours">{{tables.hours ? 'Show chart' : 'Show numbers'}}</button></div>
        <ngx-charts-heat-map *ngIf="!tables.hours && heat.length" [view]="[0, 300]" [results]="heat" [xAxis]="true" [yAxis]="true" [legend]="false" [scheme]="heatScheme"></ngx-charts-heat-map>
        <div class="table-responsive" *ngIf="tables.hours"><table class="table table-sm"><thead><tr><th>Day</th><th>Busiest hours (bills)</th></tr></thead>
          <tbody><tr *ngFor="let d of busiest"><td>{{d.day}}</td><td>{{d.text}}</td></tr></tbody></table></div>
        <div class="small text-muted" *ngIf="err.hours">{{err.hours}}</div>
      </div>
    </section>`
})
export class OwnerInsightsComponent implements OnChanges {
    @Input() storeid: number | null = null;
    @Input() canSetTargets = false;
    @Input() canSeePayables = true;

    below: any = 'below';
    health: any = null;
    healthError = '';
    salesMonths: any[] = [];
    salesSeries: any[] = [];
    categories: any = null;
    catBars: any[] = [];
    customers: any[] = [];
    custSeries: any[] = [];
    payables: any = null;
    payBars: any[] = [];
    heat: any[] = [];
    busiest: any[] = [];
    tables: any = { sales: false, cat: false, cust: false, pay: false, hours: false };
    err: any = {};

    lineScheme: any = { domain: ['#1c7ed6', '#868e96', '#ced4da'] };
    barScheme: any = { domain: ['#1c7ed6'] };
    custScheme: any = { domain: ['#2f9e44', '#1c7ed6'] };
    heatScheme: any = { domain: ['#e7f5ff', '#a5d8ff', '#4dabf7', '#1c7ed6', '#1864ab'] };

    targetInput: number | null = null;
    savingTarget = false;
    targetSaved = false;
    targetError = '';
    month = new Date().toISOString().slice(0, 7);

    constructor(private dashboard: DashboardService) {}

    get monthLabel(): string { return this.month; }
    get statusText(): string { return this.health?.status === 'healthy' ? 'Healthy' : this.health?.status === 'watch' ? 'Watch' : this.health?.status === 'act' ? 'Act now' : ''; }
    get statusClass(): string { return this.health?.status === 'healthy' ? 'bg-success' : this.health?.status === 'watch' ? 'bg-warning text-dark' : 'bg-danger'; }
    barClass(score: number): string { return score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger'; }

    ngOnChanges(changes: SimpleChanges) { if (changes.storeid || !this.health) this.load(); }

    private fail(key: string, e: any) { this.err[key] = e?.error?.message || 'This chart could not be loaded.'; }

    load() {
        this.err = {};
        this.dashboard.getHealth(this.storeid).subscribe({ next: (h: any) => { this.health = h; this.healthError = ''; }, error: (e) => (this.healthError = e?.error?.message || 'Health could not be loaded.') });
        this.dashboard.getTargets(this.month).subscribe({
            next: (t: any) => { this.targetInput = (this.storeid ? t.stores.find((s: any) => s.id === this.storeid)?.value : t.business) ?? null; },
            error: () => {}
        });
        this.dashboard.getMetric('sales-by-month', this.storeid).subscribe({
            next: (r: any) => {
                this.salesMonths = r.months;
                this.salesSeries = [
                    { name: 'This year', series: r.months.map((m: any) => ({ name: m.label, value: m.sales })) },
                    { name: 'Last year', series: r.months.map((m: any) => ({ name: m.label, value: m.lastYear })) },
                    { name: 'Two years ago', series: r.months.map((m: any) => ({ name: m.label, value: m.twoYearsAgo })) }
                ];
            }, error: (e) => this.fail('sales', e)
        });
        this.dashboard.getMetric('categories', this.storeid).subscribe({
            next: (r: any) => { this.categories = r; this.catBars = r.categories.slice(0, 8).map((c: any) => ({ name: c.category, value: Math.round(c.total) })); },
            error: (e) => this.fail('cat', e)
        });
        this.dashboard.getMetric('customers', this.storeid).subscribe({
            next: (r: any) => { this.customers = r.months; this.custSeries = r.months.map((m: any) => ({ name: m.month, series: [{ name: 'New', value: m.new }, { name: 'Returning', value: m.returning }] })); },
            error: (e) => this.fail('cust', e)
        });
        if (this.canSeePayables) this.dashboard.getMetric('payables', this.storeid).subscribe({
            next: (r: any) => { this.payables = r; this.payBars = r.buckets.map((b: any) => ({ name: b.label, value: Math.round(b.total) })); },
            error: (e) => this.fail('pay', e)
        });
        this.dashboard.getMetric('busy-hours', this.storeid).subscribe({
            next: (r: any) => {
                const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => r.cells.some((c: any) => c.hour === h));
                this.heat = names.map((d, i) => ({ name: d, series: hours.map((h) => ({ name: `${h}h`, value: r.cells.find((c: any) => c.dow === i + 1 && c.hour === h)?.bills || 0 })) }));
                this.busiest = names.map((d, i) => ({
                    day: d,
                    text: r.cells.filter((c: any) => c.dow === i + 1).sort((a: any, b: any) => b.bills - a.bills).slice(0, 3).map((c: any) => `${c.hour}h (${c.bills})`).join(', ') || 'no bills'
                }));
            }, error: (e) => this.fail('hours', e)
        });
    }

    pickMonth(_e: any) { /* the month list behind a point is the sales report; drill-through comes with the filtered list pages */ }

    saveTarget() {
        this.savingTarget = true; this.targetSaved = false; this.targetError = '';
        const value = this.targetInput === null || (this.targetInput as any) === '' ? null : Number(this.targetInput);
        this.dashboard.setTarget({ month: this.month, storeid: this.storeid, value }).subscribe({
            next: () => { this.savingTarget = false; this.targetSaved = true; this.dashboard.getHealth(this.storeid).subscribe((h: any) => (this.health = h)); },
            error: (e) => { this.savingTarget = false; this.targetError = e?.error?.message || 'The target could not be saved.'; }
        });
    }
}

import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/**
 * Store health and the interactive charts of the Owner and Manager views (DASHBOARD_AND_MENU_DESIGN 5, implementation plan stage 6).
 * The server decides what the person may see (every figure is scoped to their stores); each chart loads on its own and fails on its own.
 * Every chart can be shown as a table, which is also its text alternative.
 */
@Component({
    selector: 'app-owner-insights',
    styles: [':host { display: block; height: 100%; } .chart-box { position: relative; width: 100%; min-width: 0; overflow: hidden; } .chart-box > * { display: block; }'],
    template: `
    <section *ngIf="show('health')" class="card mb-3" aria-label="Store health" data-testid="health-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h2 class="h6 mb-1">Store health <span class="text-muted fw-normal small">weighted by your settings</span></h2>
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
            <div class="d-flex justify-content-between small" [class.text-muted]="!c.on"><span>{{c.label}}</span><strong>{{!c.on ? 'off' : c.score === null ? 'no data' : c.score}}</strong></div>
            <div class="progress" style="height: 6px" *ngIf="c.score !== null"><div class="progress-bar" [ngClass]="barClass(c.score)" [style.width.%]="c.score" role="progressbar" [attr.aria-valuenow]="c.score" aria-valuemin="0" aria-valuemax="100"></div></div>
            <div class="small text-muted">{{c.fact}}</div>
          </div>
        </div>
      </div>
    </section>

    <section *ngIf="show('tiles')" class="mb-3" aria-label="Month so far" data-testid="tiles">
      <div class="d-flex flex-wrap justify-content-between align-items-center mb-2">
        <div class="small text-muted" *ngIf="tiles">This month so far ({{tiles.period}}) against {{tiles.against}}</div>
        <div class="btn-group btn-group-sm" role="group" aria-label="Compare with">
          <button type="button" class="btn" [ngClass]="compare === 'prev' ? 'btn-primary' : 'btn-outline-primary'" (click)="setCompare('prev')" data-testid="compare-prev">Last month</button>
          <button type="button" class="btn" [ngClass]="compare === 'lastyear' ? 'btn-primary' : 'btn-outline-primary'" (click)="setCompare('lastyear')" data-testid="compare-year">Last year</button>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-6 col-lg-4 col-xl-2" *ngFor="let t of tiles?.tiles">
          <div class="card h-100"><div class="card-body py-2">
            <div class="small text-muted">{{t.label}}</div>
            <div class="fs-5 fw-bold" [attr.data-testid]="'tile-' + t.key">
              <ng-container *ngIf="t.withheld; else shown"><span class="text-muted fs-6">withheld</span></ng-container>
              <ng-template #shown>{{t.unit === 'money' ? '₹' : ''}}{{t.value | number:(t.unit === 'pct' ? '1.0-1' : '1.0-0')}}{{t.unit === 'pct' ? '%' : ''}}</ng-template>
            </div>
            <div class="small" *ngIf="t.pct !== null" [ngClass]="t.tone === 'good' ? 'text-success' : t.tone === 'bad' ? 'text-danger' : 'text-muted'" [attr.data-testid]="'tile-delta-' + t.key">
              <span aria-hidden="true">{{t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '■'}}</span> {{t.pct | number:'1.0-1'}}%
              <span class="visually-hidden">{{t.tone === 'good' ? 'better' : t.tone === 'bad' ? 'worse' : 'about the same'}} than the comparison</span>
            </div>
            <div class="small text-muted" *ngIf="t.pct === null">nothing to compare</div>
            <div class="small text-muted" *ngIf="t.key === 'margin'" data-testid="tile-margin-coverage">costed on {{t.coverage}}% of sales</div>
            <svg *ngIf="t.spark" viewBox="0 0 100 24" preserveAspectRatio="none" class="w-100" style="height: 24px" role="img" aria-label="Sales of the last 14 days"><polyline fill="none" stroke="#1c7ed6" stroke-width="1.5" [attr.points]="sparkPoints(t.spark)"></polyline></svg>
            <a *ngIf="t.link" class="small" [routerLink]="t.link">open</a>
          </div></div>
        </div>
      </div>
      <div class="small text-danger" *ngIf="err.tiles">{{err.tiles}}</div>
    </section>

    <section *ngIf="show('sales-month')" class="card h-100" aria-label="Sales by month" data-testid="chart-sales-months">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">Sales by month <span class="text-muted fw-normal small">against the same months of the last two years</span></h2>
              <button class="btn btn-sm btn-link text-nowrap" (click)="tables.sales = !tables.sales">{{tables.sales ? 'Show chart' : 'Show numbers'}}</button></div>
            <div *ngIf="!tables.sales && salesSeries.length" class="chart-box" style="height: 280px"><ngx-charts-line-chart [results]="salesSeries" [xAxis]="true" [yAxis]="true" [legend]="true" [legendPosition]="below" [showXAxisLabel]="false" [showYAxisLabel]="false" [autoScale]="true" [scheme]="lineScheme" (select)="pickMonth($event)"></ngx-charts-line-chart></div>
            <div class="table-responsive" *ngIf="tables.sales"><table class="table table-sm"><thead><tr><th>Month</th><th class="text-end">Sales</th><th class="text-end">Last year</th><th class="text-end">Two years ago</th></tr></thead>
              <tbody><tr *ngFor="let m of salesMonths"><td>{{m.month}}</td><td class="text-end">{{m.sales | number:'1.0-0'}}</td><td class="text-end">{{m.lastYear | number:'1.0-0'}}</td><td class="text-end">{{m.twoYearsAgo | number:'1.0-0'}}</td></tr></tbody></table></div>
            <div class="small text-muted" *ngIf="err.sales">{{err.sales}}</div>
          </div>
        </section>

    <section *ngIf="show('categories')" class="card h-100" aria-label="Sales by category" data-testid="chart-categories">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">Sales by category <span class="text-muted fw-normal small">{{categories?.month}}</span></h2>
              <button class="btn btn-sm btn-link text-nowrap" (click)="tables.cat = !tables.cat">{{tables.cat ? 'Show chart' : 'Show numbers'}}</button></div>
            <div *ngIf="!tables.cat && catBars.length" class="chart-box" style="height: 280px"><ngx-charts-bar-horizontal [results]="catBars" [xAxis]="true" [yAxis]="true" [scheme]="barScheme"></ngx-charts-bar-horizontal></div>
            <div class="table-responsive" *ngIf="tables.cat"><table class="table table-sm"><thead><tr><th>Category</th><th class="text-end">Sales</th><th class="text-end">Share</th></tr></thead>
              <tbody><tr *ngFor="let c of categories?.categories"><td>{{c.category}}</td><td class="text-end">{{c.total | number:'1.0-0'}}</td><td class="text-end">{{c.share}}%</td></tr></tbody></table></div>
            <div class="small text-muted" *ngIf="err.cat">{{err.cat}}</div>
          </div>
        </section>

    <section *ngIf="show('customers')" class="card h-100" aria-label="Customers" data-testid="chart-customers">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">New and returning customers <span class="text-muted fw-normal small">counts only, by month</span></h2>
              <button class="btn btn-sm btn-link text-nowrap" (click)="tables.cust = !tables.cust">{{tables.cust ? 'Show chart' : 'Show numbers'}}</button></div>
            <div *ngIf="!tables.cust && custSeries.length" class="chart-box" style="height: 260px"><ngx-charts-bar-vertical-stacked [results]="custSeries" [xAxis]="true" [yAxis]="true" [legend]="true" [legendPosition]="below" [scheme]="custScheme"></ngx-charts-bar-vertical-stacked></div>
            <div class="table-responsive" *ngIf="tables.cust"><table class="table table-sm"><thead><tr><th>Month</th><th class="text-end">New</th><th class="text-end">Returning</th><th class="text-end">Repeat rate</th></tr></thead>
              <tbody><tr *ngFor="let m of customers"><td>{{m.month}}</td><td class="text-end">{{m.new}}</td><td class="text-end">{{m.returning}}</td><td class="text-end">{{m.repeatRate}}%</td></tr></tbody></table></div>
            <div class="small text-muted" *ngIf="err.cust">{{err.cust}}</div>
          </div>
        </section>

    <section *ngIf="show('payables') && canSeePayables" class="card h-100" aria-label="What we owe" data-testid="chart-payables">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">What we owe vendors <span class="text-muted fw-normal small">by how late it is</span></h2>
              <button class="btn btn-sm btn-link text-nowrap" (click)="tables.pay = !tables.pay">{{tables.pay ? 'Show chart' : 'Show numbers'}}</button></div>
            <div *ngIf="!tables.pay && payBars.length" class="chart-box" style="height: 260px"><ngx-charts-bar-vertical [results]="payBars" [xAxis]="true" [yAxis]="true" [scheme]="barScheme"></ngx-charts-bar-vertical></div>
            <div class="table-responsive" *ngIf="tables.pay"><table class="table table-sm"><thead><tr><th>When</th><th class="text-end">Invoices</th><th class="text-end">Amount</th></tr></thead>
              <tbody><tr *ngFor="let b of payables?.buckets"><td>{{b.label}}</td><td class="text-end">{{b.count}}</td><td class="text-end">{{b.total | number:'1.0-0'}}</td></tr></tbody></table></div>
            <div class="small text-muted">Total owed ₹{{(payables?.total || 0) | number:'1.0-0'}} &middot; <a routerLink="/secure/purchases">open the invoices</a></div>
            <div class="small text-muted" *ngIf="err.pay">{{err.pay}}</div>
          </div>
        </section>

    <section *ngIf="show('deliveries')" class="card h-100" aria-label="Deliveries" data-testid="chart-deliveries">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">Deliveries by week <span class="text-muted fw-normal small" *ngIf="deliveries?.deliveredPct !== null">{{deliveries?.deliveredPct}}% delivered</span></h2>
              <button class="btn btn-sm btn-link text-nowrap" (click)="tables.del = !tables.del">{{tables.del ? 'Show chart' : 'Show numbers'}}</button></div>
            <div *ngIf="!tables.del && delSeries.length" class="chart-box" style="height: 240px"><ngx-charts-bar-vertical-stacked [results]="delSeries" [xAxis]="true" [yAxis]="true" [legend]="true" [legendPosition]="below" [scheme]="delScheme"></ngx-charts-bar-vertical-stacked></div>
            <div class="text-muted small" *ngIf="!tables.del && !delSeries.length">No deliveries in the last 8 weeks.</div>
            <div class="table-responsive" *ngIf="tables.del"><table class="table table-sm"><thead><tr><th>Week of</th><th class="text-end">Delivered</th><th class="text-end">Failed</th><th class="text-end">Pending</th></tr></thead>
              <tbody><tr *ngFor="let w of deliveries?.weeks"><td>{{w.week}}</td><td class="text-end">{{w.delivered}}</td><td class="text-end">{{w.failed}}</td><td class="text-end">{{w.pending}}</td></tr></tbody></table></div>
            <div class="small text-muted" *ngIf="err.del">{{err.del}}</div>
          </div>
        </section>

    <section *ngIf="show('expenses')" class="card h-100" aria-label="Expenses" data-testid="chart-expenses">
          <div class="card-body">
            <div class="d-flex justify-content-between"><h2 class="h6">Expenses this month <span class="text-muted fw-normal small">approved, by category</span></h2>
              <button class="btn btn-sm btn-link text-nowrap" (click)="tables.exp = !tables.exp">{{tables.exp ? 'Show chart' : 'Show numbers'}}</button></div>
            <div *ngIf="!tables.exp && expBars.length" class="chart-box" style="height: 240px"><ngx-charts-bar-horizontal [results]="expBars" [xAxis]="true" [yAxis]="true" [scheme]="barScheme"></ngx-charts-bar-horizontal></div>
            <div class="text-muted small" *ngIf="!tables.exp && !expBars.length">No approved expenses this month.</div>
            <div class="table-responsive" *ngIf="tables.exp"><table class="table table-sm"><thead><tr><th>Category</th><th class="text-end">Entries</th><th class="text-end">Amount</th></tr></thead>
              <tbody><tr *ngFor="let c of expenses?.categories"><td>{{c.category}}</td><td class="text-end">{{c.count}}</td><td class="text-end">{{c.total | number:'1.0-0'}}</td></tr></tbody></table></div>
            <div class="small text-muted">Total ₹{{(expenses?.total || 0) | number:'1.0-0'}} &middot; <a routerLink="/secure/expenses">open expenses</a></div>
            <div class="small text-muted" *ngIf="err.exp">{{err.exp}}</div>
          </div>
        </section>

    <section *ngIf="show('hours')" class="card mb-3" aria-label="Busy hours" data-testid="chart-hours">
      <div class="card-body">
        <div class="d-flex justify-content-between"><h2 class="h6">When are we busy <span class="text-muted fw-normal small">bills by weekday and hour, last 90 days</span></h2>
          <button class="btn btn-sm btn-link text-nowrap" (click)="tables.hours = !tables.hours">{{tables.hours ? 'Show chart' : 'Show numbers'}}</button></div>
        <div *ngIf="!tables.hours && heat.length" class="chart-box" style="height: 260px"><ngx-charts-heat-map [results]="heat" [xAxis]="true" [yAxis]="true" [legend]="false" [scheme]="heatScheme" [min]="0" [max]="heatMax" [innerPadding]="2"></ngx-charts-heat-map></div>
        <div class="table-responsive" *ngIf="tables.hours"><table class="table table-sm"><thead><tr><th>Day</th><th>Busiest hours (bills)</th></tr></thead>
          <tbody><tr *ngFor="let d of busiest"><td>{{d.day}}</td><td>{{d.text}}</td></tr></tbody></table></div>
        <div class="small text-muted" *ngIf="err.hours">{{err.hours}}</div>
      </div>
    </section>`
})
export class OwnerInsightsComponent implements OnChanges {
    /** which card this instance draws: health, tiles, sales-month, categories, customers, payables, deliveries, expenses or hours (the page decides where it goes) */
    @Input() part = 'health';
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
    tables: any = { sales: false, cat: false, cust: false, pay: false, hours: false, del: false, exp: false };
    tiles: any = null;
    compare: 'prev' | 'lastyear' = 'prev';
    deliveries: any = null;
    delSeries: any[] = [];
    expenses: any = null;
    expBars: any[] = [];
    delScheme: any = { domain: ['#2f9e44', '#e03131', '#adb5bd'] };
    err: any = {};

    lineScheme: any = { domain: ['#1c7ed6', '#868e96', '#ced4da'] };
    barScheme: any = { domain: ['#1c7ed6'] };
    custScheme: any = { domain: ['#2f9e44', '#1c7ed6'] };
    heatScheme: any = { domain: ['#d0ebff', '#74c0fc', '#339af0', '#1c7ed6', '#0b4a8a'] };
    /** the colour scale tops out at a busy-but-usual hour, so one extreme slot does not wash every other cell out to white */
    heatMax = 1;

    targetInput: number | null = null;
    savingTarget = false;
    targetSaved = false;
    targetError = '';
    month = new Date().toISOString().slice(0, 7);

    constructor(private dashboard: DashboardService) {}

    show(p: string): boolean { return this.part === p; }

    get monthLabel(): string { return this.month; }
    get statusText(): string { return this.health?.status === 'healthy' ? 'Healthy' : this.health?.status === 'watch' ? 'Watch' : this.health?.status === 'act' ? 'Act now' : ''; }
    get statusClass(): string { return this.health?.status === 'healthy' ? 'bg-success' : this.health?.status === 'watch' ? 'bg-warning text-dark' : 'bg-danger'; }
    barClass(score: number): string { return score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger'; }

    ngOnChanges(changes: SimpleChanges) { if (changes.storeid || changes.part || !this.loadedOnce) { this.loadedOnce = true; this.load(); } }
    private loadedOnce = false;

    private fail(key: string, e: any) { this.err[key] = e?.error?.message || 'This chart could not be loaded.'; }

    load() {
        this.err = {};
        if (this.show('health')) this.dashboard.getHealth(this.storeid).subscribe({ next: (h: any) => { this.health = h; this.healthError = ''; }, error: (e) => (this.healthError = e?.error?.message || 'Health could not be loaded.') });
        if (this.show('health')) this.dashboard.getTargets(this.month).subscribe({
            next: (t: any) => { this.targetInput = (this.storeid ? t.stores.find((s: any) => s.id === this.storeid)?.value : t.business) ?? null; },
            error: () => {}
        });
        if (this.show('tiles')) this.loadTiles();
        if (this.show('deliveries')) this.dashboard.getMetric('deliveries', this.storeid).subscribe({
            next: (r: any) => { this.deliveries = r; this.delSeries = r.weeks.map((w: any) => ({ name: this.weekLabel(w.week), series: [{ name: 'Delivered', value: w.delivered }, { name: 'Failed', value: w.failed }, { name: 'Pending', value: w.pending }] })); },
            error: (e) => this.fail('del', e)
        });
        if (this.show('expenses')) this.dashboard.getMetric('expenses', this.storeid).subscribe({
            next: (r: any) => { this.expenses = r; this.expBars = r.categories.slice(0, 8).map((c: any) => ({ name: c.category, value: Math.round(c.total) })); },
            error: (e) => this.fail('exp', e)
        });
        if (this.show('sales-month')) this.dashboard.getMetric('sales-by-month', this.storeid).subscribe({
            next: (r: any) => {
                this.salesMonths = r.months;
                this.salesSeries = [
                    { name: 'This year', series: r.months.map((m: any) => ({ name: m.label, value: m.sales })) },
                    { name: 'Last year', series: r.months.map((m: any) => ({ name: m.label, value: m.lastYear })) },
                    { name: 'Two years ago', series: r.months.map((m: any) => ({ name: m.label, value: m.twoYearsAgo })) }
                ];
            }, error: (e) => this.fail('sales', e)
        });
        if (this.show('categories')) this.dashboard.getMetric('categories', this.storeid).subscribe({
            next: (r: any) => { this.categories = r; this.catBars = r.categories.slice(0, 8).map((c: any) => ({ name: c.category, value: Math.round(c.total) })); },
            error: (e) => this.fail('cat', e)
        });
        if (this.show('customers')) this.dashboard.getMetric('customers', this.storeid).subscribe({
            next: (r: any) => { this.customers = r.months; this.custSeries = r.months.map((m: any) => ({ name: m.month, series: [{ name: 'New', value: m.new }, { name: 'Returning', value: m.returning }] })); },
            error: (e) => this.fail('cust', e)
        });
        if (this.show('payables') && this.canSeePayables) this.dashboard.getMetric('payables', this.storeid).subscribe({
            next: (r: any) => { this.payables = r; this.payBars = r.buckets.map((b: any) => ({ name: b.short || b.label, value: Math.round(b.total) })); },
            error: (e) => this.fail('pay', e)
        });
        if (this.show('hours')) this.dashboard.getMetric('busy-hours', this.storeid).subscribe({
            next: (r: any) => {
                const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => r.cells.some((c: any) => c.hour === h));
                const counts = r.cells.map((c: any) => c.bills).sort((a: number, b: number) => a - b);
                this.heatMax = Math.max(1, counts.length ? counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.9))] : 1);
                // a slot busier than the usual-busy level is drawn at that level (the "Show numbers" table has the true counts), so no cell falls off the colour scale
                this.heat = names.map((d, i) => ({ name: d, series: hours.map((h) => ({ name: `${h}h`, value: Math.min(this.heatMax, r.cells.find((c: any) => c.dow === i + 1 && c.hour === h)?.bills || 0) })) }));
                this.busiest = names.map((d, i) => ({
                    day: d,
                    text: r.cells.filter((c: any) => c.dow === i + 1).sort((a: any, b: any) => b.bills - a.bills).slice(0, 3).map((c: any) => `${c.hour}h (${c.bills})`).join(', ') || 'no bills'
                }));
            }, error: (e) => this.fail('hours', e)
        });
    }

    /** the Monday of a week as "19 Oct" */
    weekLabel(day: string): string {
        return new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    }

    setCompare(c: 'prev' | 'lastyear') { this.compare = c; this.loadTiles(); }

    sparkPoints(spark: any[]): string {
        const max = Math.max(1, ...spark.map((p) => p.value));
        return spark.map((p, i) => `${Math.round((i / Math.max(1, spark.length - 1)) * 100)},${(22 - (p.value / max) * 20).toFixed(1)}`).join(' ');
    }

    private loadTiles() {
        this.dashboard.getTiles(this.storeid, this.compare).subscribe({ next: (t: any) => { this.tiles = t; this.err.tiles = ''; }, error: (e) => this.fail('tiles', e) });
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

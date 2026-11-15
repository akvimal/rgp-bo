import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/**
 * When sales happen: hour of day, weekday, day of month, month of year (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 3).
 * Every bar is an average per trading day, and a bar with few days behind it is drawn grey. The numbers are always available as a table.
 */
@Component({
    selector: 'app-sales-patterns',
    styles: [':host { display: block; } .chart-box { position: relative; width: 100%; min-width: 0; overflow: hidden; } .chart-box > * { display: block; }'],
    template: `
    <app-widget title="When sales happen" testid="sales-patterns" [loading]="!data && !error" [error]="error" (retry)="load()"
      definition="Average sales per trading day by hour, weekday, day of month and month of year. Bars with few days behind them are grey.">
      <span sub *ngIf="data">average per trading day, {{data.basis.tradingDays}} days from {{data.basis.from}}</span>
      <div actions class="d-flex gap-2 align-items-center">
        <select class="form-select form-select-sm" style="max-width: 12rem" [(ngModel)]="category" (ngModelChange)="load()" aria-label="Product category" data-testid="patterns-category">
          <option value="">All products</option>
          <option *ngFor="let c of categories" [value]="c">{{c}}</option>
        </select>
        <button class="btn btn-sm btn-link text-nowrap" (click)="table = !table">{{table ? 'Show chart' : 'Show numbers'}}</button>
      </div>
        <ul class="nav nav-tabs my-2" role="tablist">
          <li class="nav-item" *ngFor="let t of tabs"><a class="nav-link" href="javascript:void(0)" [class.active]="tab === t.key" (click)="tab = t.key" [attr.data-testid]="'patterns-tab-' + t.key">{{t.label}}</a></li>
        </ul>
        <ng-container *ngIf="data">
          <div *ngIf="!table && series.length" class="chart-box" style="height: 260px">
            <ngx-charts-bar-vertical [results]="series" [xAxis]="true" [yAxis]="true" [customColors]="colours" [scheme]="scheme" [showGridLines]="true"></ngx-charts-bar-vertical>
          </div>
          <div class="small text-muted mb-2" *ngIf="!table">{{unit}}. Grey bars have fewer than {{thin}} {{tab === 'month' ? 'years of data' : 'days behind them'}}.</div>
          <div class="table-responsive" *ngIf="table"><table class="table table-sm">
            <thead><tr><th>{{tabLabel}}</th><th class="text-end">{{tab === 'hour' ? 'Bills per day' : 'Days'}}</th><th class="text-end">Average sales</th><th class="text-end">{{tab === 'hour' ? 'Share of sales' : 'Index (100 = average)'}}</th></tr></thead>
            <tbody><tr *ngFor="let r of rows"><td>{{r.name}}</td><td class="text-end">{{r.days}}</td><td class="text-end">{{r.avg | number:'1.0-0'}}</td><td class="text-end">{{r.metric}}</td></tr></tbody></table></div>
          <ul class="mb-0 mt-2" data-testid="patterns-notes"><li *ngFor="let n of data.notes">{{n}}</li></ul>
        </ng-container>
    </app-widget>`
})
export class SalesPatternsComponent implements OnChanges {
    @Input() storeid: number | null = null;

    data: any = null;
    error = '';
    category = '';
    categories: string[] = [];
    table = false;
    tab: string = 'hour';
    tabs = [{ key: 'hour', label: 'Hour of day' }, { key: 'weekday', label: 'Weekday' }, { key: 'dom', label: 'Day of month' }, { key: 'month', label: 'Month of year' }];
    thin = 4;
    scheme: any = { domain: ['#1c7ed6'] };
    private loadedCategories = false;

    constructor(private dashboard: DashboardService) {}

    ngOnChanges(c: SimpleChanges) { if (c.storeid || !this.data) this.load(); }

    load() {
        this.dashboard.getPatterns(this.storeid, this.category).subscribe({
            next: (d: any) => { this.data = d; this.error = ''; },
            error: (e) => (this.error = e?.error?.message || 'The patterns could not be loaded.')
        });
        if (!this.loadedCategories) {
            this.loadedCategories = true;
            this.dashboard.getMetric('categories', this.storeid).subscribe({ next: (r: any) => (this.categories = (r?.categories || []).map((c: any) => c.category)), error: () => {} });
        }
    }

    get tabLabel(): string { return this.tabs.find((t) => t.key === this.tab)!.label; }
    get unit(): string {
        return this.tab === 'hour' ? 'Sales value in each hour, divided by the trading days' : this.tab === 'weekday' ? 'Average sales on that weekday' : this.tab === 'dom' ? 'Index of that date against the average day (100)' : 'Index of that month against the average month (100), complete months only';
    }

    /**
     * One list of {name, days, avg, metric, value, thin} for whichever tab is open: the chart and the table both read it. Worked out once for a given
     * data and tab and handed back as the same arrays after that: the chart library treats a new array as new data and redraws (and restarts its
     * animation), so building them again on every check of the page kept the browser busy without end.
     */
    private memo: { data: any; tab: string; rows: any[]; series: any[]; colours: any[] } | null = null;
    private built() {
        if (!this.memo || this.memo.data !== this.data || this.memo.tab !== this.tab) {
            const rows = this.compute();
            this.memo = {
                data: this.data, tab: this.tab, rows,
                series: rows.map((r) => ({ name: r.name, value: r.value })),
                colours: rows.filter((r) => r.thin).map((r) => ({ name: r.name, value: '#ced4da' }))
            };
        }
        return this.memo;
    }
    get rows(): any[] { return this.built().rows; }
    get series(): any[] { return this.built().series; }
    get colours(): any[] { return this.built().colours; }

    private compute(): any[] {
        const d = this.data;
        if (!d) return [];
        if (this.tab === 'hour') return d.hour.filter((x: any) => x.value > 0 || (x.h >= 7 && x.h <= 22)).map((x: any) => ({ name: x.label, days: x.avgBills, avg: x.avgValue, metric: x.share + '%', value: x.avgValue, thin: false }));
        if (this.tab === 'weekday') return d.weekday.map((x: any) => ({ name: x.label, days: x.days, avg: x.avgValue, metric: x.index, value: x.avgValue, thin: x.thin }));
        if (this.tab === 'dom') return d.dom.map((x: any) => ({ name: String(x.day), days: x.days, avg: x.avgValue, metric: x.index, value: x.index, thin: x.thin }));
        return d.month.map((x: any) => ({ name: x.label, days: x.months, avg: x.avgValue, metric: x.index, value: x.index, thin: x.thin }));
    }
}

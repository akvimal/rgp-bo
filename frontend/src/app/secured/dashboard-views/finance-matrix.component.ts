import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from "@angular/core";
import { Subscription } from "rxjs";
import { DashboardFilterService, rangeOf } from "../dashboard-filter.service";
import { DashboardService } from "../dashboard.service";
import { RefreshWatch } from "./refresh-watch";

/**
 * Money by category across months (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2, phase F3): sales, returns, purchases and costs in one table,
 * rows grouped by class, one column a month, with the share of sales and the change against an earlier period. A figure opens the entries behind it.
 * What has no category sits on its own row with a way to file it (owner). A manager gets no purchases and no profit from the server.
 */
@Component({
    selector: 'app-finance-matrix',
    styles: [
        ':host { display: block; } .mx th, .mx td { white-space: nowrap; } .mx .first { position: sticky; left: 0; background: var(--bs-body-bg, #fff); z-index: 1; min-width: 12rem; }',
        '.mx tr.sec td { background: rgba(128, 128, 128, .16); color: inherit; font-weight: 600; cursor: pointer; } .mx tr.sum td { font-weight: 600; border-top: 2px solid #adb5bd; } .mx .cell { cursor: pointer; }'
    ],
    template: `
    <section class="card mb-3" aria-label="Money by category" data-testid="finance-matrix">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <h2 class="h6 mb-0">Money by category <span class="text-muted fw-normal small" *ngIf="data">{{label}}, before GST, by invoice or bill date</span></h2>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <span class="small text-muted" *ngIf="data?.asOf" data-testid="matrix-asof" title="When these figures were worked out. They are kept for a day and worked out again on the first open of each day.">{{data.refreshing ? 'Updating…' : 'As of ' + (data.asOf | date:'d MMM, h:mm a')}}</span>
            <button type="button" class="btn btn-sm btn-link p-0" *ngIf="data?.asOf" [disabled]="data.refreshing" (click)="load(true)" data-testid="matrix-refresh">Refresh</button>
            <select class="form-select form-select-sm w-auto" [(ngModel)]="view" (ngModelChange)="load()" aria-label="What to show" data-testid="matrix-view">
              <option value="pnl">Sales, purchases and costs</option><option value="products">Product categories: sold and bought</option></select>
            <button class="btn btn-sm btn-outline-secondary" (click)="download()" [disabled]="!data" data-testid="matrix-download">Download</button>
          </div>
        </div>
        <div class="small text-danger" *ngIf="error">{{error}}</div>
        <div *ngIf="!data && !error" class="text-muted small">Adding up the money...</div>
        <ng-container *ngIf="data">
          <div class="row g-2 mb-2" data-testid="matrix-tiles" *ngIf="data.view === 'pnl'">
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Sales</div><div class="h5 mb-0">{{data.summary.sales.total | number:'1.0-0'}}</div><div class="small" *ngIf="data.summary.sales.change !== null" [class.text-success]="data.summary.sales.change >= 0" [class.text-danger]="data.summary.sales.change < 0">{{data.summary.sales.change | number:'1.0-1'}}%</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Running cost</div><div class="h5 mb-0">{{data.summary.runningCost.total | number:'1.0-0'}}</div><div class="small text-muted" *ngIf="data.summary.runningCost.pct !== null">{{data.summary.runningCost.pct}}% of sales</div></div></div>
            <div class="col-6 col-md-3" *ngIf="data.summary.margin"><div class="border rounded p-2"><div class="small text-muted">Sales less purchases</div><div class="h5 mb-0">{{data.summary.margin.total | number:'1.0-0'}}</div><div class="small text-muted" *ngIf="data.summary.margin.pct !== null">{{data.summary.margin.pct}}% of sales</div></div></div>
            <div class="col-6 col-md-3" *ngIf="data.summary.profit"><div class="border rounded p-2"><div class="small text-muted">Estimated profit</div><div class="h5 mb-0" [class.text-danger]="data.summary.profit.total < 0">{{data.summary.profit.total | number:'1.0-0'}}</div><div class="small text-muted" *ngIf="data.summary.profit.pct !== null">{{data.summary.profit.pct}}% of sales</div></div></div>
          </div>
          <div class="mb-3" *ngIf="showBridge && data.view === 'pnl' && bridge.length" data-testid="profit-bridge">
            <h3 class="h6">From sales to profit <span class="text-muted fw-normal small">{{label}}</span></h3>
            <div class="d-flex align-items-center gap-2 mb-1" *ngFor="let b of bridge" [attr.data-testid]="'bridge-' + b.key">
              <div class="small text-truncate" style="width: 11rem" [class.fw-semibold]="b.total">{{b.label}}</div>
              <div class="flex-grow-1 position-relative" style="height: 1.1rem">
                <div class="position-absolute" style="height: 1.1rem; min-width: 2px; border-radius: 2px" [style.left.%]="b.left" [style.width.%]="b.width" [style.background]="b.colour"></div>
              </div>
              <div class="small text-end" style="width: 7rem">{{b.value | number:'1.0-0'}}</div>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover mx mb-2">
              <thead><tr>
                <th class="first">Category</th><th class="text-end" *ngFor="let m of data.months">{{monthName(m)}}</th>
                <th class="text-end">Total</th><th class="text-end">% of sales</th><th class="text-end" *ngIf="data.compare">Change</th></tr></thead>
              <tbody>
                <ng-container *ngFor="let s of data.sections">
                  <tr class="sec" (click)="toggle(s.cls)" [attr.data-testid]="'matrix-section-' + s.cls">
                    <td class="first">{{closed[s.cls] ? '+' : '-'}} {{s.label}}</td>
                    <td class="text-end" *ngFor="let c of s.cells">{{c | number:'1.0-0'}}</td>
                    <td class="text-end">{{s.total | number:'1.0-0'}}</td><td class="text-end">{{s.pct === null ? '' : s.pct + '%'}}</td>
                    <td class="text-end" *ngIf="data.compare">{{s.change === null ? '' : (s.change | number:'1.0-1') + '%'}}</td></tr>
                  <ng-container *ngIf="!closed[s.cls]">
                    <tr *ngFor="let r of s.rows" [attr.data-testid]="'matrix-row'">
                      <td class="first ps-4">{{r.category}} <span class="badge bg-warning text-dark" *ngIf="r.unclassified">no category</span> <span class="text-muted small" *ngIf="s.rows.length > 1 && r.grp !== r.category && s.cls !== 'INCOME' && s.cls !== 'INCOME_REDUCTION' && s.cls !== 'COST_OF_GOODS'">{{r.grp}}</span></td>
                      <td class="text-end cell" *ngFor="let c of r.cells; let i = index" (click)="open(s.cls, r, data.months[i])" [class.text-muted]="!c">{{c ? (c | number:'1.0-0') : '-'}}</td>
                      <td class="text-end cell fw-semibold" (click)="open(s.cls, r, null)">{{r.total | number:'1.0-0'}}</td>
                      <td class="text-end">{{r.pct === null ? '' : r.pct + '%'}}</td>
                      <td class="text-end" *ngIf="data.compare" [class.text-success]="r.change > 0 && s.cls === 'INCOME'" [class.text-danger]="r.change > 0 && s.cls !== 'INCOME'">{{r.change === null ? '' : (r.change | number:'1.0-1') + '%'}}</td></tr>
                  </ng-container>
                </ng-container>
                <tr class="sum" *ngIf="data.summary.profit && data.view === 'pnl'"><td class="first">Estimated profit</td><td class="text-end" *ngFor="let c of data.summary.profit.cells" [class.text-danger]="c < 0">{{c | number:'1.0-0'}}</td>
                  <td class="text-end">{{data.summary.profit.total | number:'1.0-0'}}</td><td class="text-end">{{data.summary.profit.pct === null ? '' : data.summary.profit.pct + '%'}}</td><td *ngIf="data.compare" class="text-end">{{data.summary.profit.change === null ? '' : (data.summary.profit.change | number:'1.0-1') + '%'}}</td></tr>
              </tbody>
            </table>
          </div>
          <ul class="small text-muted mb-2" data-testid="matrix-notes"><li *ngFor="let n of data.confidence.notes">{{n}}</li></ul>

          <div class="border rounded p-2 mb-2" *ngIf="drill" data-testid="matrix-drill">
            <div class="d-flex justify-content-between"><strong>{{drill.title}}</strong><button class="btn btn-sm btn-link" (click)="drill = null">Close</button></div>
            <div class="small text-danger" *ngIf="drill.error">{{drill.error}}</div>
            <div class="table-responsive" *ngIf="drill.rows"><table class="table table-sm mb-0">
              <thead><tr><th>Date</th><th>What</th><th>Store</th><th class="text-end">Amount</th><th class="text-end">GST</th></tr></thead>
              <tbody><tr *ngFor="let x of drill.rows"><td>{{x.date}}</td><td>{{x.what}}</td><td>{{x.store || 'Business'}}</td><td class="text-end">{{x.amount | number:'1.2-2'}}</td><td class="text-end">{{x.gst | number:'1.2-2'}}</td></tr></tbody></table>
              <div class="small text-muted" *ngIf="drill.limited">The newest 200 are shown. Download for the whole month.</div></div>
          </div>

          <div class="border rounded p-2" *ngIf="un && (un.expenses.length || un.products.count)" data-testid="matrix-unclassified">
            <strong>Needs a category</strong>
            <div class="small text-muted mb-1">Money with no category is kept out of profit until it is filed.</div>
            <div *ngIf="un.products.count" class="small mb-1">{{un.products.count}} products with sales have no product category ({{un.products.amount | number:'1.0-0'}} in the last year). Set the category on the product.</div>
            <div class="d-flex flex-wrap gap-2 align-items-center mb-1" *ngFor="let e of un.expenses">
              <span class="me-2">{{e.key}} <span class="text-muted small">{{e.entries}} entries, {{e.amount | number:'1.0-0'}}</span></span>
              <ng-container *ngIf="un.canFile">
                <select class="form-select form-select-sm w-auto" [(ngModel)]="pick[e.key]" [attr.aria-label]="'Class for ' + e.key">
                  <option *ngFor="let c of un.classes" [value]="c">{{className(c)}}</option></select>
                <input class="form-control form-control-sm w-auto" [(ngModel)]="pickGroup[e.key]" placeholder="Group, e.g. Premises" [attr.aria-label]="'Group for ' + e.key" />
                <button class="btn btn-sm btn-primary" (click)="file(e.key)" [disabled]="!pick[e.key] || !pickGroup[e.key]">File</button>
              </ng-container>
            </div>
            <div class="small text-danger" *ngIf="fileError">{{fileError}}</div>
          </div>
        </ng-container>
      </div>
    </section>`
})
export class FinanceMatrixComponent implements OnChanges, OnDestroy {
    @Input() storeid: number | null = null;
    /** the page for the financials shows the bridge from sales to profit; the owner only gets it (the server sends no profit to anyone else) */
    @Input() showBridge = false;

    data: any = null;
    un: any = null;
    error = '';
    fileError = '';
    view = 'pnl';
    closed: { [k: string]: boolean } = { CAPITAL_OWNER: true };
    drill: any = null;
    pick: { [k: string]: string } = {};
    pickGroup: { [k: string]: string } = {};
    private readonly names: { [k: string]: string } = { OPERATING_COST: 'Operating cost', PEOPLE: 'People', FINANCE_COST: 'Finance cost', CAPITAL_OWNER: 'Capital and owner (not in profit)' };

    private sub: Subscription;
    private first = true;

    /** the period and comparison come from the shared bar; a change reloads the card */
    constructor(private dashboard: DashboardService, private filter: DashboardFilterService) {
        this.sub = filter.filter$.subscribe(() => { if (this.first) { this.first = false; return; } this.load(); });
    }
    private rw = new RefreshWatch();
    ngOnDestroy() { this.sub.unsubscribe(); this.rw.stop(); }

    ngOnChanges(c: SimpleChanges) { if (c.storeid || !this.data) this.load(); }

    /** sales, then purchases and each cost group stepping down to the profit: the left edge and width of each bar as a share of sales */
    get bridge(): any[] {
        const d = this.data;
        if (!d || !d.summary.profit || d.summary.sales.total <= 0) return [];
        const scale = 100 / d.summary.sales.total;
        const steps: any[] = [];
        let level = d.summary.sales.total;
        steps.push({ key: 'sales', label: 'Sales, less returns', value: level, left: 0, width: level * scale, colour: '#1c7ed6', total: true });
        const take = (key: string, label: string, v: number) => {
            if (!v) return;
            const next = level - v;
            const lo = Math.min(level, next), hi = Math.max(level, next);
            steps.push({ key, label, value: -v, left: Math.max(0, lo * scale), width: Math.max(0, (hi - Math.max(0, lo)) * scale), colour: '#e8590c', total: false });
            level = next;
        };
        take('purchases', 'Purchases', d.summary.purchases ? d.summary.purchases.total : 0);
        const groups: { [g: string]: number } = {};
        for (const s of d.sections) if (['OPERATING_COST', 'PEOPLE', 'FINANCE_COST'].includes(s.cls)) for (const r of s.rows) groups[r.grp] = (groups[r.grp] || 0) + r.total;
        Object.keys(groups).sort((a, b) => groups[b] - groups[a]).forEach((g) => take('cost-' + g.toLowerCase().replace(/[^a-z]+/g, '-'), g, groups[g]));
        steps.push({ key: 'profit', label: 'Estimated profit', value: level, left: level < 0 ? 0 : 0, width: Math.max(0, level * scale), colour: level >= 0 ? '#2f9e44' : '#e03131', total: true });
        return steps;
    }

    className(c: string) { return this.names[c] || c; }
    toggle(cls: string) { this.closed[cls] = !this.closed[cls]; }
    monthName(m: string) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4); }
    get label(): string { return this.data.months[0] === this.data.months[this.data.months.length - 1] ? this.monthName(this.data.months[0]) : this.monthName(this.data.months[0]) + ' to ' + this.monthName(this.data.months[this.data.months.length - 1]); }

    /** the month range of the shared period, from today's date in India */
    private range(): { from: string; to: string } { return rangeOf(this.filter.value.period); }

    load(force = false) {
        const r = this.range();
        this.dashboard.getFinanceMatrix({ storeid: this.storeid, from: r.from, to: r.to, view: this.view, compare: this.filter.value.compare }, force).subscribe({
            next: (d: any) => { this.data = d; this.error = ''; this.rw.watch(d, () => this.load()); },
            error: (e) => (this.error = e?.error?.message || 'The figures could not be loaded.')
        });
        this.dashboard.getFinanceUnclassified(this.storeid, force).subscribe({ next: (u: any) => { this.un = u; for (const e of u.expenses) { const c = (u.categories || []).find((x: any) => x.key === e.key); this.pick[e.key] = this.pick[e.key] || (c && c.flow_class) || 'OPERATING_COST'; this.pickGroup[e.key] = this.pickGroup[e.key] || (c && c.grp) || ''; } }, error: () => (this.un = null) });
    }

    open(cls: string, row: any, month: string | null) {
        const r = this.range();
        this.drill = { title: `${row.category}${month ? ', ' + this.monthName(month) : ''}`, rows: null, error: '' };
        this.dashboard.getFinanceDrill({ storeid: this.storeid, cls, grp: row.grp, category: row.category, ...(month ? { month } : { from: r.from, to: r.to }) }).subscribe({
            next: (d: any) => (this.drill = { ...this.drill, rows: d.rows, limited: d.limited }),
            error: (e) => (this.drill = { ...this.drill, error: e?.error?.message || 'The entries could not be loaded.' })
        });
    }

    file(key: string) {
        this.fileError = '';
        this.dashboard.fileFinanceCategory({ source: 'EXPENSE', key, flow_class: this.pick[key], grp: this.pickGroup[key] }).subscribe({
            next: () => this.load(),
            error: (e) => (this.fileError = e?.error?.message || 'It could not be saved.')
        });
    }

    /** the table as a CSV file: one line per category, one column a month */
    download() {
        const d = this.data;
        const q = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
        const lines = [['Class', 'Group', 'Category', ...d.months, 'Total', '% of sales'].map(q).join(',')];
        for (const s of d.sections) for (const r of s.rows) lines.push([s.label, r.grp, r.category, ...r.cells, r.total, r.pct ?? ''].map(q).join(','));
        if (d.summary.profit && d.view === 'pnl') lines.push(['Estimated profit', '', '', ...d.summary.profit.cells, d.summary.profit.total, d.summary.profit.pct ?? ''].map(q).join(','));
        const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `money-by-category-${d.from}-to-${d.to}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
}

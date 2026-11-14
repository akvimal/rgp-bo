import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/**
 * Each cost group as a share of sales over 12 months, with the usual band, so a cost that creeps up shows early
 * (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.2 item 5). The bars are CSS; the latest complete month is marked.
 */
@Component({
    selector: 'app-cost-ratios',
    styles: [':host { display: block; } .spark { display: flex; align-items: flex-end; gap: 2px; height: 28px; } .spark i { display: block; width: 7px; background: #adb5bd; border-radius: 1px; } .spark i.last { background: #1c7ed6; } .spark i.high { background: #e03131; }'],
    template: `
    <app-widget title="Costs as a share of sales" testid="cost-ratios" [loading]="!data && !error" [error]="error" [empty]="!!data && !data.groups.length" emptyText="No costs recorded in these months." (retry)="load()"
      definition="Each cost group as a share of sales over 12 months, against its usual band: the mean of the earlier months plus or minus one standard deviation.">
      <span sub>last 12 months, before GST</span>
        <ng-container *ngIf="data">
          <div class="table-responsive" *ngIf="data.groups.length"><table class="table table-sm align-middle mb-2">
            <thead><tr><th>Cost group</th><th class="text-end">{{monthName(data.latest)}}</th><th class="text-end">Usual</th><th></th><th>12 months</th></tr></thead>
            <tbody><tr *ngFor="let g of data.groups" [attr.data-testid]="'ratio-' + g.grp">
              <td>{{g.grp}}</td>
              <td class="text-end">{{g.latest === null ? '-' : g.latest + '%'}}</td>
              <td class="text-end text-muted">{{g.band ? g.band.low + '% to ' + g.band.high + '%' : '-'}}</td>
              <td><span class="badge" [class.bg-danger]="g.status === 'high'" [class.bg-success]="g.status === 'usual' || g.status === 'low'" [class.bg-secondary]="g.status === 'thin'">{{label(g.status)}}</span></td>
              <td><div class="spark" aria-hidden="true"><i *ngFor="let p of g.series" [style.height.px]="height(g, p)" [class.last]="p.month === data.latest" [class.high]="p.month === data.latest && g.status === 'high'" [title]="monthName(p.month) + ': ' + (p.pct === null ? '-' : p.pct + '%')"></i></div></td>
            </tr></tbody></table></div>
          <ul class="mb-0 small" data-testid="ratio-notes"><li *ngFor="let n of data.notes">{{n}}</li></ul>
        </ng-container>
    </app-widget>`
})
export class CostRatiosComponent implements OnChanges {
    @Input() storeid: number | null = null;
    data: any = null;
    error = '';
    constructor(private dashboard: DashboardService) {}

    ngOnChanges(c: SimpleChanges) { if (c.storeid || !this.data) this.load(); }
    load() {
        this.error = '';
        this.dashboard.getFinanceTrend(this.storeid).subscribe({
            next: (d: any) => { this.data = d; this.error = ''; },
            error: (e) => (this.error = e?.error?.message || 'The ratios could not be loaded.')
        });
    }

    monthName(m: string) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4); }
    label(s: string) { return s === 'high' ? 'Above usual' : s === 'low' ? 'Below usual' : s === 'usual' ? 'Usual' : 'Too early to say'; }
    /** bar height from the month's share against the biggest share in the row */
    height(g: any, p: any): number {
        const max = Math.max(1, ...g.series.map((x: any) => x.pct || 0));
        return Math.max(2, Math.round(((p.pct || 0) / max) * 28));
    }
}

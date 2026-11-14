import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { COMPARES, Compare, DashFilter, DashboardFilterService, PERIODS, Period } from "../dashboard-filter.service";

/** The shared period and compare choice. The cards listed beside it follow it; the others keep their own fixed window and say so. */
@Component({
    selector: 'app-filter-bar',
    styles: [':host { display: block; }'],
    template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" role="group" aria-label="Period and comparison" data-testid="filter-bar">
      <select class="form-select form-select-sm w-auto" [ngModel]="f.period" (ngModelChange)="set({ period: $event })" aria-label="Period" data-testid="matrix-period">
        <option *ngFor="let p of periods" [value]="p.key">{{p.label}}</option></select>
      <select class="form-select form-select-sm w-auto" [ngModel]="f.compare" (ngModelChange)="set({ compare: $event })" aria-label="Compare with" data-testid="matrix-compare">
        <option *ngFor="let c of compares" [value]="c.key">{{c.label}}</option></select>
      <span class="small text-muted">Applies to money by category and the GST estimate. Sales patterns, stock and cost ratios use their own windows.</span>
    </div>`
})
export class FilterBarComponent implements OnDestroy {
    periods = PERIODS;
    compares = COMPARES;
    f: DashFilter;
    private sub: Subscription;

    constructor(private filter: DashboardFilterService) {
        this.f = filter.value;
        this.sub = filter.filter$.subscribe((v) => (this.f = v));
    }
    set(c: { period?: Period; compare?: Compare }) { this.filter.set(c); }
    ngOnDestroy() { this.sub.unsubscribe(); }
}

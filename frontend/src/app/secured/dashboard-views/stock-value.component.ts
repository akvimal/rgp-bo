import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/**
 * Stock value, expiry ladder and dead stock (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.2 item 7). Values are at the purchase rate before GST,
 * for what is on the shelf now. The ladder bars are plain CSS so they stay readable at any width.
 */
@Component({
    selector: 'app-stock-value',
    styles: [':host { display: block; } .bar { height: 1.1rem; background: #1c7ed6; border-radius: 2px; min-width: 2px; } .bar.danger { background: #e03131; }'],
    template: `
    <app-widget title="Stock on the shelf" testid="stock-value" drill="/secure/store/stock" [loading]="!data && !error" [error]="error" [empty]="!!data && data.total === 0 && !data.batches" emptyText="No stock on the shelf." (retry)="load()"
      definition="Stock at purchase rate before GST, by expiry, category and store, with the value that has not sold in 90 days.">
      <span sub>at purchase rate, before GST</span>
        <ng-container *ngIf="data">
          <div class="row g-2 mb-3" data-testid="stock-tiles">
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Stock at cost</div><div class="h5 mb-0">{{data.total | number:'1.0-0'}}</div><div class="small text-muted">{{data.totalMrp | number:'1.0-0'}} at MRP</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Expired or within 30 days</div><div class="h5 mb-0" [class.text-danger]="data.expired + data.expiring30 > 0">{{data.expired + data.expiring30 | number:'1.0-0'}}</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">No sale in 90 days</div><div class="h5 mb-0">{{data.dead.value | number:'1.0-0'}}</div><div class="small text-muted">{{data.dead.share}}% of stock</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Days of cover</div><div class="h5 mb-0">{{data.cover.days === null ? '-' : data.cover.days}}</div><div class="small text-muted" *ngIf="data.cover.turns !== null">{{data.cover.turns}} turns a year</div></div></div>
          </div>
          <h3 class="h6">When it expires</h3>
          <div class="mb-3" data-testid="stock-ladder">
            <div class="d-flex align-items-center gap-2 mb-1" *ngFor="let l of data.ladder">
              <div class="small" style="width: 10rem">{{l.label}}</div>
              <div class="flex-grow-1"><div class="bar" [class.danger]="l.danger && l.value > 0" [style.width.%]="l.share"></div></div>
              <div class="small text-end" style="width: 9rem">{{l.value | number:'1.0-0'}} <span class="text-muted">{{l.share}}%</span></div>
            </div>
          </div>
          <div class="row g-3">
            <div class="col-12" [class.col-lg-7]="data.byStore.length">
              <h3 class="h6">By product category</h3>
              <div class="table-responsive"><table class="table table-sm mb-0" data-testid="stock-categories">
                <thead><tr><th>Category</th><th class="text-end">At cost</th><th class="text-end">Share</th><th class="text-end">Expiring</th><th class="text-end">No sale in 90 days</th></tr></thead>
                <tbody><tr *ngFor="let c of data.byCategory"><td>{{c.category}}</td><td class="text-end">{{c.value | number:'1.0-0'}}</td><td class="text-end">{{c.share}}%</td><td class="text-end" [class.text-danger]="c.expiring > 0">{{c.expiring ? (c.expiring | number:'1.0-0') : '-'}}</td><td class="text-end">{{c.dead ? (c.dead | number:'1.0-0') : '-'}}</td></tr></tbody></table></div>
              <div class="small text-muted" *ngIf="data.moreCategories">and {{data.moreCategories}} smaller categories</div>
            </div>
            <div class="col-12 col-lg-5" *ngIf="data.byStore.length">
              <h3 class="h6">By store</h3>
              <div class="table-responsive"><table class="table table-sm mb-0" data-testid="stock-stores">
                <thead><tr><th>Store</th><th class="text-end">At cost</th><th class="text-end">Expiring</th><th class="text-end">No sale</th></tr></thead>
                <tbody><tr *ngFor="let s of data.byStore"><td>{{s.name}}</td><td class="text-end">{{s.value | number:'1.0-0'}}</td><td class="text-end">{{s.expiring ? (s.expiring | number:'1.0-0') : '-'}}</td><td class="text-end">{{s.dead ? (s.dead | number:'1.0-0') : '-'}}</td></tr></tbody></table></div>
            </div>
          </div>
          <ul class="mb-0 mt-2" data-testid="stock-notes"><li *ngFor="let n of data.notes">{{n}}</li></ul>
        </ng-container>
    </app-widget>`
})
export class StockValueComponent implements OnChanges {
    @Input() storeid: number | null = null;
    data: any = null;
    error = '';
    constructor(private dashboard: DashboardService) {}
    ngOnChanges(c: SimpleChanges) { if (c.storeid || !this.data) this.load(); }
    load() {
        this.error = '';
        this.dashboard.getStockValue(this.storeid).subscribe({
            next: (d: any) => { this.data = d; this.error = ''; },
            error: (e) => (this.error = e?.error?.message || 'The stock figures could not be loaded.')
        });
    }
}

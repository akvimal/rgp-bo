import { Component, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";

/**
 * Pricing > Price comparison: opens on what is in stock now (at the selected store) and compares it with one price list at a time, the PMBI Jan Aushadhi list
 * to begin with or any other seller's list loaded under Settings > Reference data. Each product shows its price (what the customer pays, per pack and per
 * unit) and the cheapest item in the chosen list for the same composition and form; the gap is how much dearer (+) or cheaper (-) the shop is. A row opens to
 * the detail and the market price from the web (asked for on request, kept a month).
 */
@Component({
  selector: "app-price-compare",
  template: `
    <div class="d-flex flex-wrap align-items-end gap-2 mb-2" data-testid="cmp-filters">
      <div><label class="form-label small mb-0">Compare with</label>
        <select class="form-select form-select-sm" style="min-width:12rem" [(ngModel)]="source" (ngModelChange)="load()" [disabled]="!lists.length" data-testid="cmp-source-filter">
          <option *ngFor="let l of lists" [ngValue]="l.id">{{l.name}}</option>
        </select></div>
      <div><label class="form-label small mb-0">Product</label><input class="form-control form-control-sm" style="width:13rem" [(ngModel)]="q" (keyup.enter)="load()" placeholder="Search by name" data-testid="cmp-q"></div>
      <div><label class="form-label small mb-0">We are dearer by at least</label>
        <div class="input-group input-group-sm" style="width:9rem"><input type="number" class="form-control" [(ngModel)]="minGap" (change)="load()" placeholder="any" data-testid="cmp-mingap"><span class="input-group-text">%</span></div></div>
      <div class="form-check mb-1"><input class="form-check-input" type="checkbox" id="cmp-stock" [(ngModel)]="inStock" (ngModelChange)="load()" data-testid="cmp-instock"><label class="form-check-label small" for="cmp-stock">In stock only</label></div>
      <div class="form-check mb-1"><input class="form-check-input" type="checkbox" id="cmp-matched" [(ngModel)]="onlyMatched" (ngModelChange)="load()" data-testid="cmp-matched"><label class="form-check-label small" for="cmp-matched">Only products found in this list</label></div>
      <button type="button" class="btn btn-sm btn-outline-primary mb-1" (click)="load()" data-testid="cmp-search">Search</button>
    </div>
    <div class="small text-muted mb-2" *ngIf="loaded && lists.length" data-testid="cmp-count">
      {{total | number}} product(s){{inStock ? ' in stock' : ''}}<span *ngIf="total > rows.length"> (first {{rows.length | number}} shown)</span>
      &middot; {{matchedCount | number}} found in {{listName}}
      &middot; {{noComposition | number}} product(s) without a composition are not compared
    </div>
    <div *ngIf="error" class="alert alert-danger py-2">{{error}}</div>
    <div class="alert alert-info py-2 small" *ngIf="loaded && !lists.length" data-testid="cmp-no-lists">No price lists are loaded yet. The Business Head loads them under Settings &gt; Reference data.</div>

    <div class="table-responsive" *ngIf="rows.length">
      <table class="table table-sm table-hover align-middle" data-testid="cmp-table">
        <thead><tr><th></th><th>Product</th><th>Composition</th><th class="text-end">In stock</th><th class="text-end">Pack</th><th class="text-end">MRP</th><th class="text-end">Our price</th><th class="text-end">Per unit</th>
          <th>{{listName}}: cheapest</th><th class="text-end">Per unit</th><th class="text-end">Our gap</th></tr></thead>
        <tbody>
          <ng-container *ngFor="let r of rows">
            <tr data-testid="cmp-row" [class.table-active]="open === r.productid">
              <td><button type="button" class="btn btn-sm btn-link py-0" (click)="toggle(r)" [attr.aria-expanded]="open === r.productid" data-testid="cmp-open"><i class="bi" [ngClass]="open === r.productid ? 'bi-chevron-down' : 'bi-chevron-right'"></i></button></td>
              <td class="fw-semibold">{{r.title}}</td>
              <td class="small">{{r.composition}}<span class="text-muted" *ngIf="r.form"> &middot; {{r.form}}</span></td>
              <td class="text-end" data-testid="cmp-stock">{{r.available | number}}</td>
              <td class="text-end">{{r.pack}}</td>
              <td class="text-end">{{r.mrp | number:'1.2-2'}}</td>
              <td class="text-end">{{r.price | number:'1.2-2'}}</td>
              <td class="text-end">{{r.unitPrice | number:'1.2-2'}}</td>
              <ng-container *ngIf="r.sources[0] as s; else notListed">
                <td class="small"><span *ngIf="s.cheapest">{{s.cheapest.name}} <span class="text-muted">({{s.cheapest.unitSize}})</span></span>
                  <span *ngIf="!s.cheapest && s.perPackOnly.length" class="text-muted">pack in ml or g: see the detail</span>
                  <span *ngIf="!s.cheapest && !s.perPackOnly.length && s.unitMrp" class="text-muted">MRP only</span></td>
                <td class="text-end" data-testid="cmp-list-unit"><span *ngIf="s.unitSell">{{s.unitSell.min | number:'1.2-2'}}<span *ngIf="s.unitSell.max !== s.unitSell.min"> to {{s.unitSell.max | number:'1.2-2'}}</span></span>
                  <span *ngIf="!s.unitSell && s.unitMrp" class="text-muted">MRP {{s.unitMrp.min | number:'1.2-2'}}</span></td>
                <td class="text-end"><span *ngIf="s.gap !== null" class="badge" [ngClass]="s.gap > 0 ? 'bg-danger' : 'bg-success'" data-testid="cmp-gap">{{s.gap > 0 ? '+' : ''}}{{s.gap | number:'1.0-1'}}%</span></td>
              </ng-container>
              <ng-template #notListed><td colspan="3" class="small text-muted" data-testid="cmp-not-listed">not in {{listName}}</td></ng-template>
            </tr>
            <tr *ngIf="open === r.productid" data-testid="cmp-detail"><td></td><td colspan="10"><app-price-compare-panel [productId]="r.productid"></app-price-compare-panel></td></tr>
          </ng-container>
        </tbody>
      </table>
    </div>
    <div class="hist-empty" *ngIf="loaded && lists.length && !rows.length && !error"><i class="bi bi-inboxes"></i>Nothing to show with these filters. Products need a composition with a strength (add it in the product){{inStock ? ' and stock at this store' : ''}}.</div>
    <div class="small text-muted" *ngIf="rows.length">Prices are per unit (a tablet or capsule) with GST, the price a customer pays. The PMBI Jan Aushadhi list sells at its MRP. A list item sold by volume or weight (ml, g) has no unit to compare and is shown on the row detail. Stock is what is on the shelf at the selected store, in date for at least 30 days.</div>`
})
export class PriceCompareComponent implements OnInit, OnDestroy {
  q = "";
  /** the list compared with; the PMBI list (the first) until another is chosen */
  source: number | null = null;
  minGap: number | null = null;
  inStock = true;
  onlyMatched = false;
  rows: any[] = [];
  lists: any[] = [];
  total = 0;
  noComposition = 0;
  loaded = false;
  error = "";
  open: number | null = null;
  private subs = new Subscription();
  private storeId: number | null = null;

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  get listName(): string { return this.lists.find(l => l.id === this.source)?.name || "the list"; }
  get matchedCount(): number { return this.rows.filter(r => r.sources.length).length; }

  ngOnInit() {
    this.storeId = this.storeContext.selectedStoreId ?? null;
    this.subs.add(this.storeContext.selectedStoreId$.subscribe((id: any) => {
      const next = id ?? null;
      if (next !== this.storeId) { this.storeId = next; this.load(); }
    }));
    this.load();
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  load() {
    this.error = ""; this.open = null;
    const params: any = {};
    if (this.q.trim()) params.q = this.q.trim();
    if (this.source) params.source = String(this.source);
    if (this.minGap !== null && this.minGap !== undefined && String(this.minGap) !== "") params.mingap = String(this.minGap);
    if (this.onlyMatched) params.matched = "1";
    if (this.inStock) params.instock = "1";
    if (this.storeId) params.storeid = String(this.storeId);
    this.http.get<any>(`${environment.apiHost}/price-compare/products`, { params }).subscribe({
      next: d => {
        this.lists = d.lists || [];
        // the first look names no list: the PMBI list (listed first) is chosen, and the page is asked again for it
        if (!this.source && this.lists.length) { this.source = this.lists[0].id; this.load(); return; }
        this.rows = d.products || []; this.total = d.total || 0; this.noComposition = d.noComposition || 0; this.loaded = true;
      },
      error: e => { this.loaded = true; this.rows = []; const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || "Could not load the comparison."); },
    });
  }

  toggle(r: any) { this.open = this.open === r.productid ? null : r.productid; }
}

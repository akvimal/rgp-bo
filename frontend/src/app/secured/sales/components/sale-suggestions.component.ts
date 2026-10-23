import { Component, DoCheck, EventEmitter, HostListener, Input, OnDestroy, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";

/**
 * Ideas to mention to the customer, kept out of the way: a small button under the items ("Suggestions 3") that opens a short
 * list on demand. Cross-sell (what others bought with these), a same-composition alternative that earns more, and one line
 * - not one per medicine - offering a longer supply for regular medicines. Shown / added / dismissed are logged when the list is
 * opened and acted on, so the acceptance can be measured. Nothing is added until the cashier presses a button.
 */
@Component({
  selector: "app-sale-suggestions",
  template: `
    <div class="position-relative" *ngIf="count" data-testid="sale-suggestions-wrap">
      <button type="button" class="btn btn-sm btn-link text-muted text-decoration-none" (click)="toggle($event)" [attr.aria-expanded]="open" data-testid="sale-suggestions-toggle">
        <i class="bi bi-lightbulb"></i> Suggestions <span class="badge rounded-pill bg-light text-dark border">{{count}}</span>
      </button>
      <div *ngIf="open" class="card shadow-sm position-fixed p-2 small" [ngStyle]="panelPos" style="z-index:1100; width:30rem; max-width:90vw; max-height:18rem; overflow:auto" data-testid="sale-suggestions">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="fw-semibold">Worth mentioning to the customer</span>
          <button type="button" class="btn-close" style="font-size:.6rem" (click)="open = false" aria-label="Close"></button>
        </div>

        <ng-container *ngIf="cross.length">
          <div class="text-muted mt-1">Customers also bought</div>
          <div *ngFor="let s of cross" class="d-flex align-items-center gap-2 py-1 border-top" data-testid="sale-sugg-cross-item" [attr.data-product]="s.productid">
            <span class="flex-grow-1">{{s.title}} <span class="text-muted">&#8377;{{s.price | number:'1.0-0'}}</span></span>
            <button type="button" class="btn btn-sm btn-outline-primary py-0" (click)="addCross(s)">Add</button>
            <button type="button" class="btn btn-sm btn-link text-muted py-0" (click)="dismiss(s)" aria-label="Not now">&times;</button>
          </div>
        </ng-container>

        <ng-container *ngIf="swaps.length">
          <div class="text-muted mt-2">Same composition, better value</div>
          <div *ngFor="let u of swaps" class="d-flex align-items-center gap-2 py-1 border-top" data-testid="sale-sugg-SAME_COMPOSITION" [attr.data-product]="u.productid">
            <span class="flex-grow-1"><span class="text-muted">{{u.anchortitle}} &rarr;</span> {{u.title}} <span class="text-muted">&#8377;{{u.price | number:'1.0-0'}} &middot; +{{u.marginGain}} pts</span></span>
            <button type="button" class="btn btn-sm btn-outline-primary py-0" (click)="swapTo(u)">Switch</button>
            <button type="button" class="btn btn-sm btn-link text-muted py-0" (click)="dismiss(u)" aria-label="Not now">&times;</button>
          </div>
        </ng-container>

        <ng-container *ngIf="bulk.length">
          <div class="text-muted mt-2">Longer supply</div>
          <div class="d-flex align-items-center gap-2 py-1 border-top" data-testid="sale-sugg-BULK_SUPPLY">
            <span class="flex-grow-1">{{bulk.length}} regular medicine{{bulk.length === 1 ? '' : 's'}} on this bill ({{bulkNames}}). Offer a {{bulk[0].months}}-month supply.</span>
            <button type="button" class="btn btn-sm btn-outline-primary py-0" (click)="markAll()" data-testid="sale-sugg-bulk-all" title="Sets each one to {{bulk[0].months}} months of units; you can change them">Make it {{bulk[0].months}} months</button>
            <button type="button" class="btn btn-sm btn-link text-muted py-0" (click)="dismissBulk()" aria-label="Not now">&times;</button>
          </div>
        </ng-container>
      </div>
    </div>`,
})
export class SaleSuggestionsComponent implements DoCheck, OnDestroy {
  @Input() items: any[] = [];
  @Output() add = new EventEmitter<any>();
  @Output() swap = new EventEmitter<any>();
  @Output() supply = new EventEmitter<any>();

  cross: any[] = [];
  swaps: any[] = [];
  bulk: any[] = [];
  open = false;
  private key = "";
  private timer: any = null;
  private shown = new Set<string>();
  private dismissed = new Set<string>();

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  ngOnDestroy() { clearTimeout(this.timer); }

  get count(): number { return this.cross.length + this.swaps.length + (this.bulk.length ? 1 : 0); }

  get bulkNames(): string {
    const n = this.bulk.map(b => b.anchortitle);
    return n.length > 3 ? `${n.slice(0, 3).join(", ")} and ${n.length - 3} more` : n.join(", ");
  }

  /** the lines change in place, so look at them each cycle and ask again (after a pause) when the products or supplies change */
  ngDoCheck() {
    const lines = (this.items || []).filter(i => +i.qty > 0 && (i.product_id || i.productid));
    const k = lines.map(i => `${i.product_id || i.productid}:${i.supplymonths || ""}`).sort().join(",") + "|" + this.storeContext.selectedStoreId;
    if (k === this.key) return;
    this.key = k;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(lines), 450);
  }

  private id(s: any) { return `${s.kind}:${s.anchorproductid || ""}:${s.productid || ""}`; }

  private refresh(lines: any[]) {
    if (!lines.length) { this.cross = []; this.swaps = []; this.bulk = []; this.open = false; return; }
    this.http.post<any>(`${environment.apiHost}/sale-suggestions`, {
      storeid: this.storeContext.selectedStoreId,
      items: lines.map(i => ({ productid: i.product_id || i.productid, supplymonths: i.supplymonths || null })),
    }).subscribe({
      next: d => {
        const live = (x: any) => !this.dismissed.has(this.id(x));
        this.cross = (d.crossSell || []).filter(live).slice(0, 4);
        const up = (d.upsell || []).filter(live);
        this.swaps = up.filter((u: any) => u.kind === "SAME_COMPOSITION");
        this.bulk = up.filter((u: any) => u.kind === "BULK_SUPPLY");
        if (!this.count) this.open = false;
      },
      error: () => { this.cross = []; this.swaps = []; this.bulk = []; },
    });
  }

  /** a suggestion counts as shown once the list has actually been opened */
  /** the panel is fixed to the screen, beside its button, so the grid's own scrolling cannot cut it off */
  panelPos: any = {};

  @HostListener('window:resize') closeOnResize() { this.open = false; }

  toggle(ev?: any) {
    this.open = !this.open;
    if (!this.open) return;
    const r = ev?.currentTarget?.getBoundingClientRect?.();
    if (r) {
      const room = window.innerHeight - r.bottom;
      this.panelPos = { right: (window.innerWidth - r.right) + 'px', ...(room > 300 ? { top: (r.bottom + 4) + 'px' } : { bottom: (window.innerHeight - r.top + 4) + 'px' }) };
    }
    const visible = [...this.cross, ...this.swaps, ...(this.bulk.length ? [this.bulk[0]] : [])].filter(s => !this.shown.has(this.id(s)));
    visible.forEach(s => this.shown.add(this.id(s)));
    if (visible.length) this.log(visible.map(s => this.event(s, "SHOWN")));
  }

  private event(s: any, action: string) {
    return { kind: s.kind, action, anchor_product_id: s.anchorproductid || null, suggested_product_id: s.productid || null };
  }

  private log(events: any[]) {
    this.http.post(`${environment.apiHost}/sale-suggestions/events`, { storeid: this.storeContext.selectedStoreId, events }).subscribe({ error: () => { /* logging never stops a sale */ } });
  }

  addCross(s: any) { this.log([this.event(s, "ADDED")]); this.add.emit(s); this.drop(s); }
  swapTo(u: any) { this.log([this.event(u, "ADDED")]); this.swap.emit(u); this.drop(u); }

  /** one press marks every regular medicine; it counts as one suggestion taken */
  markAll() {
    this.log([this.event(this.bulk[0], "ADDED")]);
    this.bulk.forEach(b => this.supply.emit(b));
    this.dismissBulk(false);
  }

  dismiss(s: any) { this.log([this.event(s, "DISMISSED")]); this.drop(s); }
  dismissBulk(log = true) {
    if (log && this.bulk.length) this.log([this.event(this.bulk[0], "DISMISSED")]);
    this.bulk.forEach(b => this.dismissed.add(this.id(b)));
    this.bulk = [];
    if (!this.count) this.open = false;
  }

  private drop(s: any) {
    this.dismissed.add(this.id(s));
    this.cross = this.cross.filter(x => this.id(x) !== this.id(s));
    this.swaps = this.swaps.filter(x => this.id(x) !== this.id(s));
    if (!this.count) this.open = false;
  }
}

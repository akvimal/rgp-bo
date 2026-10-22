import { Component, DoCheck, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";

/**
 * What to say to the customer while the bill is being made: what others bought with these, the same composition earning
 * more, a longer supply for a chronic medicine. Shown, added and dismissed suggestions are logged so the acceptance can be
 * measured. It only suggests; nothing is added until the cashier presses the button.
 */
@Component({
  selector: "app-sale-suggestions",
  template: `
    <div class="border rounded p-2 mb-2 bg-light" *ngIf="cross.length || upsell.length" data-testid="sale-suggestions">
      <div class="small fw-semibold mb-1"><i class="bi bi-lightbulb me-1"></i>Suggest to the customer</div>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-1" *ngIf="cross.length" data-testid="sale-sugg-cross">
        <span class="small text-muted">Customers also bought:</span>
        <span *ngFor="let s of cross" class="btn-group btn-group-sm" data-testid="sale-sugg-cross-item" [attr.data-product]="s.productid">
          <button type="button" class="btn btn-outline-primary" (click)="addCross(s)" [title]="s.together + ' bills had this together'">+ {{s.title}} <span class="text-muted">&#8377;{{s.price | number:'1.0-0'}}</span></button>
          <button type="button" class="btn btn-outline-secondary" (click)="dismiss(s)" aria-label="Not now">&times;</button>
        </span>
      </div>
      <div *ngFor="let u of upsell" class="small d-flex flex-wrap gap-2 align-items-center mb-1" [attr.data-testid]="'sale-sugg-' + u.kind" [attr.data-product]="u.productid || u.anchorproductid">
        <ng-container *ngIf="u.kind === 'SAME_COMPOSITION'">
          <span><strong>{{u.anchortitle}}</strong>: same composition, better value &rarr; <strong>{{u.title}}</strong> (&#8377;{{u.price | number:'1.0-0'}}, {{u.marginGain}} points more margin)</span>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="swapTo(u)">Switch to it</button>
        </ng-container>
        <ng-container *ngIf="u.kind === 'BULK_SUPPLY'">
          <span><strong>{{u.anchortitle}}</strong> is a regular medicine: offer a {{u.months}}-month supply.</span>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="bulk(u)">Mark as {{u.months}} months</button>
        </ng-container>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="dismiss(u)" aria-label="Not now">&times;</button>
      </div>
    </div>`,
})
export class SaleSuggestionsComponent implements DoCheck, OnDestroy {
  @Input() items: any[] = [];
  @Output() add = new EventEmitter<any>();
  @Output() swap = new EventEmitter<any>();
  @Output() supply = new EventEmitter<any>();

  cross: any[] = [];
  upsell: any[] = [];
  private key = "";
  private timer: any = null;
  private shown = new Set<string>();
  private dismissed = new Set<string>();

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  ngOnDestroy() { clearTimeout(this.timer); }

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
    if (!lines.length) { this.cross = []; this.upsell = []; return; }
    this.http.post<any>(`${environment.apiHost}/sale-suggestions`, {
      storeid: this.storeContext.selectedStoreId,
      items: lines.map(i => ({ productid: i.product_id || i.productid, supplymonths: i.supplymonths || null })),
    }).subscribe({
      next: d => {
        this.cross = (d.crossSell || []).filter((s: any) => !this.dismissed.has(this.id(s)));
        this.upsell = (d.upsell || []).filter((s: any) => !this.dismissed.has(this.id(s)));
        const fresh = [...this.cross, ...this.upsell].filter(s => !this.shown.has(this.id(s)));
        fresh.forEach(s => this.shown.add(this.id(s)));
        if (fresh.length) this.log(fresh.map(s => this.event(s, "SHOWN")));
      },
      error: () => { this.cross = []; this.upsell = []; },
    });
  }

  private event(s: any, action: string) {
    return { kind: s.kind, action, anchor_product_id: s.anchorproductid || null, suggested_product_id: s.productid || null };
  }

  private log(events: any[]) {
    this.http.post(`${environment.apiHost}/sale-suggestions/events`, { storeid: this.storeContext.selectedStoreId, events }).subscribe({ error: () => { /* logging never stops a sale */ } });
  }

  addCross(s: any) { this.log([this.event(s, "ADDED")]); this.add.emit(s); this.drop(s); }
  swapTo(u: any) { this.log([this.event(u, "ADDED")]); this.swap.emit(u); this.drop(u); }
  bulk(u: any) { this.log([this.event(u, "ADDED")]); this.supply.emit(u); this.drop(u); }
  dismiss(s: any) { this.log([this.event(s, "DISMISSED")]); this.drop(s); }

  private drop(s: any) {
    this.dismissed.add(this.id(s));
    this.cross = this.cross.filter(x => this.id(x) !== this.id(s));
    this.upsell = this.upsell.filter(x => this.id(x) !== this.id(s));
  }
}

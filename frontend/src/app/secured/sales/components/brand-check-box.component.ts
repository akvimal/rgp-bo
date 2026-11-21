import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";
import { BrandCheckBus } from "./brand-check.bus";
import { SaleAlternativesComponent } from "./sale-alternatives.component";

/**
 * Check brand as a type-ahead in the Sales header: type at least three letters of the brand a customer asked for, pick it from the brand dictionary, and the
 * Check brand dialog opens on that brand (its composition, the price online and what we stock). Only offered when a brand dictionary has been loaded.
 */
@Component({
  selector: "app-brand-check-box",
  template: `
    <div class="position-relative d-inline-block" *ngIf="available" data-testid="brand-check-box">
      <input class="form-control form-control-sm" style="width:14rem" [(ngModel)]="text" (ngModelChange)="typed()" (keydown.escape)="close()" (blur)="closeSoon()" (keydown.enter)="pickFirst()"
        placeholder="Check brand" autocomplete="off" aria-label="Check a brand" title="Type a brand the customer asked for: its composition, price and matching stock" data-testid="brand-check-input">
      <div class="list-group position-absolute shadow mt-1" style="z-index:1050; width:26rem; max-width:90vw; max-height:18rem; overflow:auto" *ngIf="results.length" data-testid="brand-check-results">
        <button type="button" class="list-group-item list-group-item-action py-1 small" *ngFor="let b of results" (mousedown)="pick(b); $event.preventDefault()" data-testid="brand-check-pick">
          <strong>{{b.brand}}</strong>
          <span class="text-muted"> &middot; {{b.formLabel || 'form not stated'}}<span *ngIf="b.manufacturer"> &middot; {{b.manufacturer}}</span></span>
          <div class="text-muted fst-italic">{{b.composition}}</div>
        </button>
      </div>
      <div class="list-group position-absolute shadow mt-1" style="z-index:1050; width:16rem" *ngIf="searched && !results.length" data-testid="brand-check-none">
        <div class="list-group-item py-1 small text-muted">No brand found with that name.</div>
      </div>
      <div class="list-group position-absolute shadow mt-1" style="z-index:1050; width:16rem" *ngIf="text.trim().length > 0 && text.trim().length < 3" data-testid="brand-check-short">
        <div class="list-group-item py-1 small text-muted">Type at least three letters.</div>
      </div>
    </div>
    <app-sale-alternatives [brandMode]="true" [showTrigger]="false" [canAdd]="bus.billOpen" (pick)="bus.pick$.next($event)"></app-sale-alternatives>`
})
export class BrandCheckBoxComponent implements OnInit, OnDestroy {
  @ViewChild(SaleAlternativesComponent) dialog?: SaleAlternativesComponent;
  available = false;
  text = "";
  results: any[] = [];
  searched = false;
  private timer: any = null;
  private seq = 0;

  constructor(private http: HttpClient, public bus: BrandCheckBus, private storeContext: StoreContextService) {}

  /** the box is offered only when a brand dictionary is loaded */
  ngOnInit() {
    this.http.get<any>(`${environment.apiHost}/sale-alternatives/brands`, { params: { q: "" } }).subscribe({
      next: d => this.available = !!d?.available,
      error: () => this.available = false,
    });
  }

  ngOnDestroy() { clearTimeout(this.timer); }

  typed() {
    clearTimeout(this.timer);
    this.searched = false;
    const q = this.text.trim();
    if (q.length < 3) { this.results = []; return; }
    this.timer = setTimeout(() => {
      const mine = ++this.seq;
      this.http.get<any>(`${environment.apiHost}/sale-alternatives/brands`, { params: { q } }).subscribe({
        next: d => { if (mine !== this.seq) return; this.results = d?.results || []; this.searched = true; },
        error: () => { if (mine !== this.seq) return; this.results = []; this.searched = true; },
      });
    }, 300);
  }

  pickFirst() { if (this.results.length) this.pick(this.results[0]); }

  pick(b: any) {
    this.close();
    this.text = "";
    this.dialog?.openBrand(b);
  }

  close() { clearTimeout(this.timer); this.seq++; this.results = []; this.searched = false; }

  /**
   * A short wait so a click on a result is not lost to the box losing focus first. A brand typed that nothing matched, and left without choosing anything, is a
   * request we could not meet: it is kept for the weekly review (the same record the dialog used to make). A failure here never gets in the counter's way.
   */
  closeSoon() {
    setTimeout(() => {
      const missed = this.searched && !this.results.length && this.text.trim().length >= 3 ? this.text.trim() : null;
      this.results = []; this.searched = false;
      if (missed) {
        this.text = "";
        this.http.post(`${environment.apiHost}/sale-alternatives/lookup-log`, { kind: "TYPED", text: missed, storeid: this.storeContext.selectedStoreId || null }).subscribe({ error: () => {} });
      }
    }, 150);
  }
}

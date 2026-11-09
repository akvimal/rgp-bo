import { Component, EventEmitter, Input, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";
import { dosageFormLabel } from "../../products/dosage-forms";

/**
 * A customer asks for a brand: pick the medicine they named (ours, in stock or not) or, when it is not in our list, type the brand and pick it from the brand
 * dictionary; then see what has the same composition, strength and dosage form and is in stock, with batch, use-by and the price against the one asked for.
 * The same ingredients in another strength, or the same composition in another dosage form, are listed apart. A medicine that needs a prescription is marked.
 * When nothing is in stock, a few other brands of that composition are listed to ask a vendor for. Whether to offer a substitute is the pharmacist decision,
 * so nothing is added until "Add to bill" is pressed.
 */
@Component({
  selector: "app-sale-alternatives",
  template: `
    <button *ngIf="showTrigger" type="button" class="btn btn-sm btn-link text-decoration-none" (click)="open()" data-testid="alt-open">
      <i class="bi bi-arrow-left-right"></i> Find alternatives
    </button>
    <p-dialog header="Check brand / find alternatives" [(visible)]="show" [modal]="true" [style]="{width:'46rem', maxWidth:'96vw'}" [contentStyle]="{'min-height':'26rem'}" [draggable]="false" (onHide)="clear()">
      <div class="small text-muted mb-2">Type the brand the customer asked for to see its generic composition, and what we stock with the same composition, strength and form.</div>

      <!-- any brand: the brand dictionary gives its composition -->
      <div *ngIf="dictionary" data-testid="alt-dict">
        <label class="form-label small mb-0" for="alt-brand">Brand the customer asked for</label>
        <input id="alt-brand" class="form-control form-control-sm" [(ngModel)]="brandText" (ngModelChange)="brandTyped()" placeholder="e.g. Augmentin, Telma, Glycomet" autocomplete="off" data-testid="alt-brand">
        <div class="small text-muted mt-1" *ngIf="brandText.trim().length > 0 && brandText.trim().length < 3">Type at least three letters.</div>
        <div class="small text-muted mt-1" *ngIf="brandSearched && !brandResults.length" data-testid="alt-brand-none">No brand found with that name. Try fewer letters.</div>
        <div class="list-group mt-1" *ngIf="brandResults.length" style="max-height:12rem; overflow:auto" data-testid="alt-brand-results">
          <button type="button" class="list-group-item list-group-item-action py-1 small" *ngFor="let b of brandResults" (click)="pickBrand(b)" data-testid="alt-brand-pick">
            <strong>{{b.brand}}</strong>
            <span class="text-muted"> &middot; {{b.formLabel || 'form not stated'}}<span *ngIf="b.manufacturer"> &middot; {{b.manufacturer}}</span></span>
            <div class="text-muted fst-italic">{{b.composition}}</div>
          </button>
        </div>
      </div>

      <div class="mt-3">
        <label class="form-label small mb-0" *ngIf="dictionary">Or pick a medicine from our own list</label>
        <app-product-select (selected)="pickAsked($event)" [reset]="resetBox"></app-product-select>
      </div>

      <div *ngIf="loading" class="text-muted small mt-3">Looking...</div>
      <div *ngIf="error" class="alert alert-danger small mt-3" data-testid="alt-error">{{error}}</div>

      <ng-container *ngIf="r && !loading">
        <div class="mt-3" data-testid="alt-asked">
          <strong>{{r.asked.title}}</strong>
          <span *ngIf="r.asked.fromDictionary" class="badge bg-secondary ms-2" data-testid="alt-from-dict">From the brand dictionary</span>
          <span *ngIf="r.askedInStock" class="badge bg-success ms-2">In stock ({{r.askedAvailable}})</span>
          <span *ngIf="r.status === 'OK' && !r.asked.fromDictionary && !r.askedInStock" class="badge bg-warning text-dark ms-2">Not in stock</span>
          <div class="small text-muted fst-italic">{{r.asked.composition || 'No composition recorded'}}</div>
          <div class="small text-muted" *ngIf="askedFormLabel" data-testid="alt-asked-form">{{askedFormLabel}}<span *ngIf="r.asked.manufacturer"> &middot; {{r.asked.manufacturer}}</span></div>
        </div>

        <div *ngIf="r.status === 'NO_COMPOSITION'" class="alert alert-warning small mt-2" data-testid="alt-no-composition">
          This medicine has no composition recorded, so alternatives cannot be found. Add its composition in the product, then try again.
        </div>
        <div *ngIf="r.status === 'NO_STRENGTH'" class="alert alert-warning small mt-2" data-testid="alt-no-strength">
          The composition has no strength (for example 500 mg), so a match would not be safe. Add the strength in the product, then try again.
        </div>

        <ng-container *ngIf="r.status === 'OK'">
          <h6 class="mt-3 mb-1">Same composition and strength, in stock</h6>
          <div *ngIf="!r.same.length" class="text-muted small" data-testid="alt-none">None in stock{{r.askedInStock ? ' other than the one asked for' : ''}}.</div>
          <div *ngFor="let a of r.same" class="d-flex align-items-center gap-2 py-1 border-top" data-testid="alt-same" [attr.data-product]="a.productid">
            <div class="flex-grow-1">
              <div><strong>{{a.title}}</strong>
                <span *ngIf="a.generic" class="badge bg-info text-dark ms-1">Generic</span>
                <span *ngIf="a.prescription" class="badge bg-danger ms-1" title="Schedule {{a.schedule}}">Prescription</span>
                <span *ngIf="a.formRelation === 'unknown'" class="badge bg-warning text-dark ms-1" title="Its dosage form is not recorded; check the pack is the same form" data-testid="alt-form-unknown">Form not recorded</span></div>
              <div class="small text-muted"><span *ngIf="a.mfr">{{a.mfr}} &middot; </span>Batch {{a.batch}}<span *ngIf="a.exp_date"> / {{a.exp_date | date:'MMM-yy'}}</span> &middot; {{a.available}} in stock</div>
            </div>
            <div class="text-end small text-nowrap">
              <div>MRP &#8377;{{a.mrp | number:'1.2-2'}} &middot; Rate &#8377;{{a.price | number:'1.2-2'}}</div>
              <div *ngIf="a.cheaperPct !== null" [class.text-success]="a.cheaperPct > 0" [class.text-danger]="a.cheaperPct < 0" [class.text-muted]="a.cheaperPct === 0">
                {{a.cheaperPct > 0 ? a.cheaperPct + '% cheaper' : (a.cheaperPct < 0 ? (-a.cheaperPct) + '% dearer' : 'same price')}} per unit
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="add(a)" data-testid="alt-add">Add to bill</button>
          </div>

          <ng-container *ngIf="r.otherForms?.length">
            <h6 class="mt-3 mb-1">Same composition, different form</h6>
            <div class="small text-muted mb-1">For example a sustained-release tablet against a plain tablet: not a substitute unless the doctor or pharmacist agrees.</div>
            <div *ngFor="let a of r.otherForms" class="d-flex align-items-center gap-2 py-1 border-top small" data-testid="alt-other-form" [attr.data-product]="a.productid">
              <span class="flex-grow-1">{{a.title}} <span class="badge bg-secondary ms-1">{{formLabel(a.form)}}</span>
                <span *ngIf="a.prescription" class="badge bg-danger ms-1">Prescription</span></span>
              <span class="text-nowrap">&#8377;{{a.price | number:'1.2-2'}} &middot; {{a.available}} in stock</span>
              <button type="button" class="btn btn-sm btn-outline-secondary py-0" (click)="add(a)">Add to bill</button>
            </div>
          </ng-container>

          <ng-container *ngIf="r.otherStrengths.length">
            <h6 class="mt-3 mb-1">Same ingredients, different strength</h6>
            <div class="small text-muted mb-1">Not a substitute unless the doctor or pharmacist agrees to the change.</div>
            <div *ngFor="let a of r.otherStrengths" class="d-flex align-items-center gap-2 py-1 border-top small" data-testid="alt-other" [attr.data-product]="a.productid">
              <span class="flex-grow-1">{{a.title}} <span class="text-muted fst-italic">{{a.composition}}</span>
                <span *ngIf="a.prescription" class="badge bg-danger ms-1">Prescription</span></span>
              <span class="text-nowrap">&#8377;{{a.price | number:'1.2-2'}} &middot; {{a.available}} in stock</span>
              <button type="button" class="btn btn-sm btn-outline-secondary py-0" (click)="add(a)">Add to bill</button>
            </div>
          </ng-container>

          <div *ngIf="!r.same.length && r.notStocked.length" class="small mt-3 text-muted" data-testid="alt-not-stocked">
            Known but not in stock now: {{notStockedNames}}.
          </div>

          <ng-container *ngIf="r.orderIdeas?.length">
            <h6 class="mt-3 mb-1">Not in stock: other brands of this composition to order</h6>
            <div class="small text-muted mb-1">From the brand dictionary, not a stock list. Ask a vendor which of these it has; no price is shown.</div>
            <div *ngFor="let o of r.orderIdeas" class="small py-1 border-top" data-testid="alt-order-idea">
              <strong>{{o.brand}}</strong> <span class="text-muted">&middot; {{o.formLabel || 'form not stated'}}<span *ngIf="o.manufacturer"> &middot; {{o.manufacturer}}</span></span>
            </div>
          </ng-container>
        </ng-container>

        <div class="small text-muted mt-3" *ngIf="r.source" data-testid="alt-source">
          Brand data: {{r.source.name}}<span *ngIf="r.source.version"> ({{r.source.version}})</span>, National Resource Centre for EHR Standards, C-DAC, Ministry of Health and Family Welfare (CC BY 4.0).
          Brand names belong to their owners. Not medical advice: the pharmacist decides on a substitute.
        </div>
      </ng-container>
    </p-dialog>`,
})
export class SaleAlternativesComponent {
  /** the link that opens the dialog; a screen with its own button (the POS "Check brand") turns it off and calls open() itself */
  @Input() showTrigger = true;
  @Output() pick = new EventEmitter<any>();
  show = false;
  loading = false;
  error = "";
  r: any = null;
  resetBox = false;

  /** the brand dictionary: loaded or not, and what was typed */
  dictionary = false;
  brandText = "";
  brandResults: any[] = [];
  brandSearched = false;
  private timer: any = null;
  private seq = 0;

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  get notStockedNames(): string {
    return (this.r?.notStocked || []).map((n: any) => n.title).join(", ");
  }

  get askedFormLabel(): string {
    return dosageFormLabel(this.r?.asked?.form) || this.r?.asked?.formLabel || "";
  }

  formLabel(key: string | null | undefined) { return dosageFormLabel(key) || "form not recorded"; }

  /** opening the dialog also finds out whether a brand dictionary has been loaded (without it the brand search is not offered) */
  open(prefill?: string) {
    this.show = true;
    const text = (prefill || "").trim();
    this.brandText = text;
    this.http.get<any>(`${environment.apiHost}/sale-alternatives/brands`, { params: { q: "" } }).subscribe({
      next: (d) => {
        this.dictionary = !!d?.available;
        if (this.dictionary && text.length >= 3) this.brandTyped();          // the brand typed at the counter is looked up straight away
        if (this.dictionary) setTimeout(() => (document.getElementById("alt-brand") as HTMLInputElement | null)?.focus(), 150);
      },
      error: () => this.dictionary = false,
    });
  }

  pickAsked(p: any) {
    const id = +(p?.id || 0);
    if (!id) return;
    this.loading = true; this.error = ""; this.r = null;
    this.http.get<any>(`${environment.apiHost}/sale-alternatives`, { params: { productid: String(id), storeid: String(this.storeContext.selectedStoreId || "") } }).subscribe({
      next: d => { this.r = d; this.loading = false; },
      error: e => { this.loading = false; this.error = e?.error?.message || "Could not look up alternatives."; },
    });
  }

  /** a short wait after typing, then the dictionary is asked (a slow answer for an older text is dropped) */
  brandTyped() {
    clearTimeout(this.timer);
    this.brandSearched = false;
    const q = this.brandText.trim();
    if (q.length < 3) { this.brandResults = []; return; }
    this.timer = setTimeout(() => {
      const mine = ++this.seq;
      this.http.get<any>(`${environment.apiHost}/sale-alternatives/brands`, { params: { q } }).subscribe({
        next: (d) => { if (mine !== this.seq) return; this.brandResults = d?.results || []; this.brandSearched = true; },
        error: () => { if (mine !== this.seq) return; this.brandResults = []; this.brandSearched = true; },
      });
    }, 300);
  }

  pickBrand(b: any) {
    this.loading = true; this.error = ""; this.r = null; this.brandResults = []; this.brandSearched = false;
    this.http.get<any>(`${environment.apiHost}/sale-alternatives/brand`, { params: { brandid: String(b.id), storeid: String(this.storeContext.selectedStoreId || "") } }).subscribe({
      next: d => { this.r = d; this.loading = false; },
      error: e => { this.loading = false; this.error = e?.error?.message || "Could not look up that brand."; },
    });
  }

  add(a: any) {
    this.pick.emit({ productid: a.productid });
    this.show = false;
  }

  clear() {
    this.r = null; this.error = ""; this.loading = false;
    this.brandText = ""; this.brandResults = []; this.brandSearched = false; clearTimeout(this.timer);
    this.resetBox = true; setTimeout(() => this.resetBox = false);
  }
}

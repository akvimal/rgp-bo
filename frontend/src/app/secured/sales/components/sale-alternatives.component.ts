import { Component, EventEmitter, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";

/**
 * A customer asks for a brand: pick the medicine they named (in stock or not) and see what has the same composition and
 * strength and is in stock, with batch, use-by and the price against the one asked for. The same ingredients in another strength
 * are listed apart. A medicine that needs a prescription is marked. Whether to offer a substitute is the pharmacist decision, so
 * nothing is added until "Add to bill" is pressed.
 */
@Component({
  selector: "app-sale-alternatives",
  template: `
    <button type="button" class="btn btn-sm btn-link text-decoration-none" (click)="show = true" data-testid="alt-open">
      <i class="bi bi-arrow-left-right"></i> Find alternatives
    </button>
    <p-dialog header="Find alternatives" [(visible)]="show" [modal]="true" [style]="{width:'46rem', maxWidth:'96vw'}" [contentStyle]="{'min-height':'26rem'}" [draggable]="false" (onHide)="clear()">
      <div class="small text-muted mb-2">Type the brand the customer asked for. Medicines with the same composition and strength that are in stock are listed below.</div>
      <app-product-select (selected)="pickAsked($event)" [reset]="resetBox"></app-product-select>

      <div *ngIf="loading" class="text-muted small mt-3">Looking...</div>
      <div *ngIf="error" class="alert alert-danger small mt-3" data-testid="alt-error">{{error}}</div>

      <ng-container *ngIf="r && !loading">
        <div class="mt-3" data-testid="alt-asked">
          <strong>{{r.asked.title}}</strong>
          <span *ngIf="r.askedInStock" class="badge bg-success ms-2">In stock ({{r.askedAvailable}})</span>
          <span *ngIf="r.status === 'OK' && !r.askedInStock" class="badge bg-warning text-dark ms-2">Not in stock</span>
          <div class="small text-muted fst-italic">{{r.asked.composition || 'No composition recorded'}}</div>
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
                <span *ngIf="a.prescription" class="badge bg-danger ms-1" title="Schedule {{a.schedule}}">Prescription</span></div>
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
        </ng-container>
      </ng-container>
    </p-dialog>`,
})
export class SaleAlternativesComponent {
  @Output() pick = new EventEmitter<any>();
  show = false;
  loading = false;
  error = "";
  r: any = null;
  resetBox = false;

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  get notStockedNames(): string {
    return (this.r?.notStocked || []).map((n: any) => n.title).join(", ");
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

  add(a: any) {
    this.pick.emit({ productid: a.productid });
    this.show = false;
  }

  clear() {
    this.r = null; this.error = ""; this.loading = false;
    this.resetBox = true; setTimeout(() => this.resetBox = false);
  }
}

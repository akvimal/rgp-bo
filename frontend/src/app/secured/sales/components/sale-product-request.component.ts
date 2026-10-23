import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PurchaseIntentService } from "../../store/intent/purchase-intent.service";
import { ProductsService } from "../../products/products.service";

/**
 * A quick capture, from the billing screen, of a product the customer wants and the store does not have. It is saved as a
 * purchase request (source Customer) so purchasing can see it, and the customer's name and number come over from the bill.
 * A product that is not in the product list at all is typed by name; purchasing links it to a product (or creates one) before it is ordered.
 */
@Component({
  selector: "app-sale-product-request",
  template: `
    <p-dialog header="Request a product we don't have" [visible]="visible" (visibleChange)="visibleChange.emit($event)" (onShow)="reset()" [modal]="true" [style]="{width: '36rem'}" [draggable]="false">
      <div class="row g-3" data-testid="pos-request-dialog">
        <div class="col-12" *ngIf="error"><div class="alert alert-danger py-2 mb-0" data-testid="pos-request-error">{{error}}</div></div>
        <div class="col-12">
          <label class="form-label">Product <span class="text-danger">*</span></label>
          <ng-container *ngIf="!typed">
            <div *ngIf="product" class="mb-1 fw-semibold" data-testid="pos-request-product-name">{{product.title}}</div>
            <app-product-select [reset]="resetSelect" (selected)="product = $event"></app-product-select>
            <a role="button" class="small d-inline-block mt-1" (click)="useTyped()" data-testid="pos-request-unlisted"><i class="bi bi-pencil me-1"></i>Not in the list? Type its name instead</a>
          </ng-container>
          <ng-container *ngIf="typed">
            <input class="form-control" maxlength="200" [(ngModel)]="name" (ngModelChange)="lookup()" placeholder="Name, brand and strength" data-testid="pos-request-name">
            <div class="small mt-1" *ngIf="matches.length" data-testid="pos-request-matches">Is it one of these?
              <button type="button" class="btn btn-sm btn-outline-secondary ms-1 mb-1" *ngFor="let m of matches" (click)="pick(m)" data-testid="pos-request-match">{{m.title}}</button>
            </div>
            <div class="form-text">Not in our product list yet. Purchasing will add it before it is ordered.</div>
            <a role="button" class="small d-inline-block mt-1" (click)="useList()" data-testid="pos-request-listed"><i class="bi bi-search me-1"></i>Search the product list instead</a>
          </ng-container>
        </div>
        <div class="col-4"><label class="form-label">Quantity <span class="text-danger">*</span></label><input type="number" min="1" class="form-control" [(ngModel)]="qty" data-testid="pos-request-qty"></div>
        <div class="col-4"><label class="form-label">Needed by</label><input type="date" class="form-control" [(ngModel)]="neededby" data-testid="pos-request-needed"></div>
        <div class="col-4"><label class="form-label">Priority</label>
          <select class="form-select" [(ngModel)]="priority" data-testid="pos-request-priority"><option *ngFor="let p of priorities" [value]="p">{{p}}</option></select></div>
        <div class="col-6"><label class="form-label">Customer</label><input class="form-control" maxlength="80" [(ngModel)]="customername" data-testid="pos-request-cname"></div>
        <div class="col-6"><label class="form-label">Mobile</label><input class="form-control" maxlength="20" [(ngModel)]="customerphone" data-testid="pos-request-cphone"></div>
        <div class="col-12"><label class="form-label">Notes</label><input class="form-control" maxlength="300" [(ngModel)]="comments" placeholder="Brand, strength, anything the buyer should know" data-testid="pos-request-notes"></div>
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="btn btn-outline-secondary" (click)="visibleChange.emit(false)">Cancel</button>
        <button type="button" class="btn btn-primary ms-2" [disabled]="saving" (click)="save()" data-testid="pos-request-save">Save request</button>
      </ng-template>
    </p-dialog>`,
})
export class SaleProductRequestComponent {
  @Input() visible = false;
  @Input() customerName = "";
  @Input() customerPhone = "";
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<string>();

  readonly priorities = ["Low", "Normal", "High", "Urgent"];
  product: any = null;
  /** the product is not in the list: its name is typed, and the product list is checked as the name is typed */
  typed = false;
  name = "";
  matches: any[] = [];
  private lookupTimer: any = null;
  qty: number | null = 1;
  neededby = "";
  priority = "Normal";
  customername = "";
  customerphone = "";
  comments = "";
  error = "";
  saving = false;
  resetSelect = false;

  constructor(private requests: PurchaseIntentService, private products: ProductsService) {}

  /** each time it opens: empty, with the bill's customer filled in */
  reset() {
    this.product = null; this.typed = false; this.name = ""; this.matches = []; this.qty = 1; this.neededby = ""; this.priority = "Normal"; this.comments = ""; this.error = ""; this.saving = false;
    this.customername = this.customerName || "";
    this.customerphone = this.customerPhone || "";
    this.resetSelect = true;
    setTimeout(() => this.resetSelect = false);
  }

  useTyped() { this.typed = true; this.product = null; this.error = ""; }
  useList() { this.typed = false; this.matches = []; this.error = ""; }

  /** what is typed may already be in the list under a longer name: offer those (a few, after a short pause) */
  lookup() {
    clearTimeout(this.lookupTimer);
    const words = (this.name || "").split(/\s+/).map(w => w.replace(/[^A-Za-z0-9.]/g, "")).filter(w => w.length >= 3).slice(0, 3);
    if (!words.length) { this.matches = []; return; }
    this.lookupTimer = setTimeout(() => {
      this.products.findByCriteria({ condition: "all", criteria: words.map(w => ({ property: "title", check: "contains", value: w })) }).subscribe({
        next: (d: any) => this.matches = (d || []).slice(0, 5),
        error: () => this.matches = [],
      });
    }, 300);
  }

  pick(m: any) { this.product = m; this.typed = false; this.matches = []; this.error = ""; }

  save() {
    this.error = "";
    const typedName = (this.name || "").trim();
    if (this.typed && typedName.length < 2) { this.error = "Type the product name."; return; }
    if (!this.typed && !this.product?.id) { this.error = "Choose the product, or type its name if it is not in the list."; return; }
    if (!(Number(this.qty) > 0)) { this.error = "Enter how many are needed."; return; }
    this.saving = true;
    this.requests.save({
      ...(this.typed ? { requestedname: typedName } : { productid: +this.product.id }), qty: Math.floor(Number(this.qty)), source: "Customer", requesttype: "Ad Hoc", priority: this.priority, status: "Open",
      neededby: this.neededby || null, customername: (this.customername || "").trim() || null, customerphone: (this.customerphone || "").trim() || null,
      comments: (this.comments || "").trim() || null,
    }).subscribe({
      next: () => { this.saving = false; this.saved.emit(this.typed ? typedName : this.product.title); this.visibleChange.emit(false); },
      error: (err: any) => { this.saving = false; const m = err?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || "Unable to save the request."); },
    });
  }
}

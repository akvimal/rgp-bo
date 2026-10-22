import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PurchaseIntentService } from "../../store/intent/purchase-intent.service";

/**
 * A quick capture, from the billing screen, of a product the customer wants and the store does not have. It is saved as a
 * purchase request (source Customer) so purchasing can see it, and the customer's name and number come over from the bill.
 */
@Component({
  selector: "app-sale-product-request",
  template: `
    <p-dialog header="Request a product we don't have" [visible]="visible" (visibleChange)="visibleChange.emit($event)" (onShow)="reset()" [modal]="true" [style]="{width: '36rem'}" [draggable]="false">
      <div class="row g-3" data-testid="pos-request-dialog">
        <div class="col-12" *ngIf="error"><div class="alert alert-danger py-2 mb-0" data-testid="pos-request-error">{{error}}</div></div>
        <div class="col-12">
          <label class="form-label">Product <span class="text-danger">*</span></label>
          <div *ngIf="product" class="mb-1 fw-semibold" data-testid="pos-request-product-name">{{product.title}}</div>
          <app-product-select [reset]="resetSelect" (selected)="product = $event"></app-product-select>
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
  qty: number | null = 1;
  neededby = "";
  priority = "Normal";
  customername = "";
  customerphone = "";
  comments = "";
  error = "";
  saving = false;
  resetSelect = false;

  constructor(private requests: PurchaseIntentService) {}

  /** each time it opens: empty, with the bill's customer filled in */
  reset() {
    this.product = null; this.qty = 1; this.neededby = ""; this.priority = "Normal"; this.comments = ""; this.error = ""; this.saving = false;
    this.customername = this.customerName || "";
    this.customerphone = this.customerPhone || "";
    this.resetSelect = true;
    setTimeout(() => this.resetSelect = false);
  }

  save() {
    this.error = "";
    if (!this.product?.id) { this.error = "Choose the product."; return; }
    if (!(Number(this.qty) > 0)) { this.error = "Enter how many are needed."; return; }
    this.saving = true;
    this.requests.save({
      productid: +this.product.id, qty: Math.floor(Number(this.qty)), source: "Customer", requesttype: "Ad Hoc", priority: this.priority, status: "Open",
      neededby: this.neededby || null, customername: (this.customername || "").trim() || null, customerphone: (this.customerphone || "").trim() || null,
      comments: (this.comments || "").trim() || null,
    }).subscribe({
      next: () => { this.saving = false; this.saved.emit(this.product.title); this.visibleChange.emit(false); },
      error: (err: any) => { this.saving = false; const m = err?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || "Unable to save the request."); },
    });
  }
}

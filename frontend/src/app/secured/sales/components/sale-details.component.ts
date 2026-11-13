import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { SaleService } from "../sales.service";

/**
 * The bill, its documents and its delivery in a panel beside the list, so a bill can be looked at (and its prescription opened) without leaving the
 * list. The list row already carries the totals and the delivery; the items and the attached documents come from the bill itself.
 */
@Component({
  selector: "app-sale-details",
  template: `
    <p-sidebar [visible]="!!sale" (visibleChange)="!$event && close()" position="right" [style]="{width: '34rem', maxWidth: '100vw'}" [baseZIndex]="1000" styleClass="sale-details">
      <div *ngIf="sale" data-testid="bill-details">
        <div class="d-flex align-items-start justify-content-between mb-2">
          <div>
            <h5 class="mb-0">Bill {{sale.billno}} <span class="badge bg-info text-dark ms-1" *ngIf="sale.deliverytype === 'Delivery'">Delivery</span></h5>
            <div class="small text-muted">{{sale.billdate | date:'dd MMM yyyy, h:mm a'}} &middot; {{sale.ordertype || 'Walk-in'}}<span *ngIf="sale.staffname"> &middot; {{sale.staffname}}</span></div>
            <div class="small" *ngIf="sale.custinfo">{{sale.custinfo}}</div>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-3">
          <a class="btn btn-sm btn-primary" [routerLink]="['../pos/view', sale.id]" data-testid="bd-print"><i class="bi bi-printer"></i> Print</a>
          <a class="btn btn-sm btn-outline-secondary" *ngIf="canEdit" [routerLink]="['../pos/edit', sale.id]" data-testid="bd-edit"><i class="bi bi-pencil"></i> Edit</a>
          <button type="button" class="btn btn-sm btn-outline-secondary" *ngIf="canReturn" (click)="returnClick.emit(sale)" data-testid="bd-return"><i class="bi bi-arrow-return-left"></i> Return</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" *ngIf="canChangeDelivery" (click)="deliveryClick.emit(sale)" data-testid="bd-delivery">
            <i class="bi" [ngClass]="sale.deliverytype === 'Delivery' ? 'bi-bag-check' : 'bi-truck'"></i> {{sale.deliverytype === 'Delivery' ? 'Change to counter sale' : 'Create delivery'}}</button>
        </div>

        <div class="alert alert-danger py-2" *ngIf="error">{{error}}</div>
        <div class="text-muted small" *ngIf="loading">Loading the bill...</div>

        <h6 class="text-uppercase text-muted small mb-1">Items</h6>
        <table class="table table-sm mb-3" *ngIf="items.length" data-testid="bd-items">
          <thead><tr><th>Item</th><th class="text-end">Qty</th><th class="text-end">Price</th><th class="text-end">Total</th></tr></thead>
          <tbody>
            <tr *ngFor="let i of items">
              <td>{{i.product?.title || i.title || ('#' + i.productid)}}<div class="small text-muted" *ngIf="i.batch">Batch {{i.batch}}</div></td>
              <td class="text-end">{{i.qty}}</td>
              <td class="text-end">{{i.price | number:'1.2-2'}}</td>
              <td class="text-end">{{i.total | number:'1.2-2'}}</td>
            </tr>
          </tbody>
        </table>
        <div class="small text-muted mb-3" *ngIf="!items.length && !loading">No items to show.</div>

        <h6 class="text-uppercase text-muted small mb-1">Payment</h6>
        <table class="table table-sm mb-3" data-testid="bd-payment">
          <tbody>
            <tr *ngIf="+f.discamount > 0"><td>Discount</td><td class="text-end">{{f.discamount | number:'1.2-2'}}</td></tr>
            <tr *ngIf="+f.cashamt > 0"><td>Cash</td><td class="text-end">{{f.cashamt | number:'1.2-2'}}</td></tr>
            <tr *ngIf="+f.digiamt > 0"><td>{{f.digimethod || 'Digital'}}<span class="small text-muted" *ngIf="f.digirefno"> &middot; ref {{f.digirefno}}</span></td><td class="text-end">{{f.digiamt | number:'1.2-2'}}</td></tr>
            <tr *ngIf="+f.staffcreditamt > 0"><td>Staff credit</td><td class="text-end">{{f.staffcreditamt | number:'1.2-2'}}</td></tr>
            <tr *ngIf="+f.creditamt > 0"><td>Store credit</td><td class="text-end">{{f.creditamt | number:'1.2-2'}}</td></tr>
            <tr *ngIf="+f.commitmentamt > 0"><td>Advance paid earlier</td><td class="text-end">{{f.commitmentamt | number:'1.2-2'}}</td></tr>
            <tr *ngIf="+f.dueamt > 0"><td>To pay later<span class="small text-muted" *ngIf="f.duedate"> &middot; by {{f.duedate | date:'dd MMM yyyy'}}</span></td><td class="text-end">{{f.dueamt | number:'1.2-2'}}</td></tr>
            <tr class="fw-semibold"><td>Total</td><td class="text-end">{{f.total | number:'1.2-2'}}</td></tr>
          </tbody>
        </table>

        <h6 class="text-uppercase text-muted small mb-1">Documents</h6>
        <div *ngIf="docs.length" data-testid="bd-docs">
          <div class="d-flex align-items-center border rounded p-2 mb-2" *ngFor="let doc of docs" data-testid="bd-doc">
            <i class="bi bi-file-earmark-text fs-4 me-2"></i>
            <div class="flex-grow-1">
              <div>{{doc.alias || doc.name || doc.category}}</div>
              <span class="badge bg-light text-dark border" *ngIf="doc.category">{{doc.category}}</span>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="view(doc)" data-testid="bd-doc-view"><i class="bi bi-eye"></i> View</button>
          </div>
        </div>
        <div class="small text-muted mb-3" *ngIf="!docs.length">No documents on this bill.</div>

        <ng-container *ngIf="sale.deliverytype === 'Delivery'">
          <h6 class="text-uppercase text-muted small mb-1">Delivery</h6>
          <div class="border rounded p-2 small" data-testid="bd-delivery-box">
            <div><span class="badge" [ngClass]="statusClass(sale.delivery?.status)">{{sale.delivery?.status || 'Pending'}}</span>
              <span class="ms-2">{{sale.delivery?.deliverymethod || 'Staff Delivery'}}<span *ngIf="sale.delivery?.courierpartner"> &middot; {{sale.delivery?.courierpartner}}</span></span></div>
            <div class="mt-1" *ngIf="sale.delivery?.receivername || sale.delivery?.receiverphone">{{sale.delivery?.receivername}} {{sale.delivery?.receiverphone}}</div>
            <div class="text-muted" *ngIf="sale.delivery?.receiveraddress">{{sale.delivery?.receiveraddress}}</div>
            <div class="text-muted" *ngIf="sale.delivery?.deliveryby">Delivered by {{sale.delivery?.deliveryby}}</div>
            <a class="d-inline-block mt-1" routerLink="../deliveries">Open Deliveries</a>
          </div>
        </ng-container>
      </div>
    </p-sidebar>

    <p-dialog [header]="docname || 'Document'" [(visible)]="showDoc" [modal]="true" [style]="{ width: '60rem' }" [dismissableMask]="true" [baseZIndex]="2000">
      <app-document-viewer *ngIf="showDoc" [path]="docpath" [name]="docname"></app-document-viewer>
    </p-dialog>`
})
export class SaleDetailsComponent implements OnChanges {
  /** the bill row from the list (null = closed) */
  @Input() sale: any = null;
  @Input() canEdit = false;
  @Input() canReturn = false;
  @Input() canChangeDelivery = false;
  @Output() closed = new EventEmitter<void>();
  @Output() deliveryClick = new EventEmitter<any>();
  @Output() returnClick = new EventEmitter<any>();

  full: any = null;
  loading = false;
  error = "";
  showDoc = false;
  docpath = "";
  docname = "";

  constructor(private service: SaleService) {}

  /** the bill itself once loaded, otherwise the row */
  get f(): any { return { ...(this.sale || {}), ...(this.full || {}) }; }
  get items(): any[] { return this.full?.items || []; }
  get docs(): any[] { return (this.full?.props?.documents || this.sale?.props?.documents || []); }

  ngOnChanges(c: SimpleChanges) {
    if (c["sale"]) {
      this.full = null; this.error = ""; this.showDoc = false;
      if (this.sale?.id) {
        this.loading = true;
        this.service.find(this.sale.id).subscribe(
          (r: any) => { this.full = r; this.loading = false; },
          () => { this.loading = false; this.error = "The bill could not be loaded."; });
      }
    }
  }

  close() { this.closed.emit(); }

  view(doc: any) { this.docpath = doc.path; this.docname = doc.alias || doc.name || doc.category || ""; this.showDoc = true; }

  statusClass(status: string): string {
    switch ((status || "").toLowerCase()) {
      case "delivered": return "bg-success";
      case "failed": return "bg-danger";
      case "cancelled": return "bg-secondary";
      case "assigned": return "bg-info text-dark";
      default: return "bg-warning text-dark";
    }
  }
}

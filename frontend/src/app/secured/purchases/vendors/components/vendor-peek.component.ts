import { Component, EventEmitter, Input, Output } from "@angular/core";
import { stateName } from "../gst-util";

/**
 * A vendor read beside the list (docs/planning/UI_PATTERNS.md): who they are, what we buy from them and what is owed. It shows what the list row already
 * holds, so it opens at once; Edit and the invoice links are in the header and body. Blocking, disabling and the rest stay as list actions.
 */
@Component({
    selector: 'app-vendor-peek',
    template: `
    <app-peek [open]="!!vendor" [title]="vendor?.name || ''" [subtitle]="vendor?.legalname && vendor?.legalname !== vendor?.name ? vendor?.legalname : ''" testid="vpeek"
      [fullPage]="vendor ? ['/secure/purchases/vendors/edit', vendor.id] : null" fullPageLabel="Edit" (closed)="closed.emit()">
      <span badges *ngIf="vendor">
        <span class="badge bg-danger ms-1" *ngIf="vendor.status === 'BLOCKED'">Blocked</span>
        <span class="badge bg-secondary ms-1" *ngIf="vendor.status === 'DISABLED'">Disabled</span>
      </span>
      <ng-container *ngIf="vendor">
        <div class="alert alert-danger py-2 small" *ngIf="vendor.status === 'BLOCKED'" data-testid="vpeek-blocked">{{vendor.blockreason}}<span *ngIf="vendor.blockedon"> &middot; since {{vendor.blockedon | date:'dd MMM yyyy'}}</span></div>

        <div class="row g-2 mb-3" data-testid="vpeek-money">
          <div class="col-6"><div class="border rounded p-2"><div class="small text-muted">Owed</div>
            <div class="h5 mb-0" [class.text-danger]="vendor.stats?.overdue > 0">{{(vendor.stats?.outstanding || 0) | currency:'INR':'symbol':'1.0-0'}}</div>
            <div class="small text-danger" *ngIf="vendor.stats?.overdue > 0">{{vendor.stats.overdue | currency:'INR':'symbol':'1.0-0'}} overdue</div></div></div>
          <div class="col-6"><div class="border rounded p-2"><div class="small text-muted">Bought, last 12 months</div>
            <div class="h5 mb-0">{{(vendor.stats?.last12 || 0) | currency:'INR':'symbol':'1.0-0'}}</div>
            <div class="small text-muted">{{(vendor.stats?.total || 0) | currency:'INR':'symbol':'1.0-0'}} in all</div></div></div>
        </div>

        <dl class="row mb-2 small">
          <dt class="col-4">Last purchase</dt><dd class="col-8">{{vendor.stats?.lastpurchase ? (vendor.stats.lastpurchase | date:'dd MMM yyyy') : 'none yet'}}<span *ngIf="vendor.stats?.invoices"> &middot; {{vendor.stats.invoices}} invoice{{vendor.stats.invoices === 1 ? '' : 's'}}</span></dd>
          <dt class="col-4">Last payment</dt><dd class="col-8">{{vendor.stats?.lastpayment ? (vendor.stats.lastpayment | date:'dd MMM yyyy') : '-'}}<span *ngIf="vendor.paymenttermsdays"> &middot; {{vendor.paymenttermsdays}} day terms</span></dd>
          <dt class="col-4">Contact</dt><dd class="col-8">{{vendor.contactname || '-'}}<div *ngIf="vendor.mobile || vendor.contactphone">{{vendor.mobile || vendor.contactphone}}</div><div class="text-muted" *ngIf="vendor.repname">Rep: {{vendor.repname}}</div></dd>
          <dt class="col-4">GSTIN</dt>
          <dd class="col-8">
            <span *ngIf="vendor.gstn">{{vendor.gstn}}</span>
            <span class="badge bg-danger ms-1" *ngIf="vendor.gstinInvalid" title="Not a valid GSTIN: edit and correct it">check</span>
            <span class="badge ms-1" *ngIf="!vendor.gstn" [ngClass]="vendor.registrationtype === 'UNREGISTERED' ? 'bg-secondary' : 'bg-warning text-dark'">{{vendor.registrationtype === 'UNREGISTERED' ? 'not registered' : 'missing'}}</span>
            <div class="text-muted" *ngIf="vendor.statecode">{{stateName(vendor.statecode)}}</div>
          </dd>
          <dt class="col-4">Licence</dt>
          <dd class="col-8" data-testid="vpeek-licence"><span class="badge" [ngClass]="licenceClass">{{licenceText}}</span><span class="text-muted ms-1" *ngIf="vendor.licensenextexpiry">till {{vendor.licensenextexpiry | date:'dd MMM yyyy'}}</span></dd>
        </dl>

        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-sm btn-outline-secondary" [routerLink]="['/secure/purchases/invoices/list']" [queryParams]="{vendor: vendor.id}" data-testid="vpeek-invoices">Invoices</a>
          <a class="btn btn-sm btn-outline-secondary" *ngIf="vendor.stats?.outstanding > 0" [routerLink]="['/secure/purchases/invoices/outstanding']" [queryParams]="{vendor: vendor.id}" data-testid="vpeek-outstanding">What is owed</a>
        </div>
      </ng-container>
    </app-peek>`
})
export class VendorPeekComponent {
    /** the vendor row to show (null = closed) */
    @Input() vendor: any = null;
    @Output() closed = new EventEmitter<void>();
    readonly stateName = stateName;

    get licenceText(): string {
        const s = this.vendor?.licensestatus;
        return s === 'VALID' ? 'Valid' : s === 'EXPIRING' ? 'Expiring' : s === 'EXPIRED' ? 'Expired' : 'None recorded';
    }
    get licenceClass(): string {
        const s = this.vendor?.licensestatus;
        return s === 'VALID' ? 'bg-success' : s === 'EXPIRING' ? 'bg-warning text-dark' : s === 'EXPIRED' ? 'bg-danger' : 'bg-secondary';
    }
}

import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { InvoiceService } from "../invoices.service";

/**
 * A purchase invoice read beside the list (docs/planning/UI_PATTERNS.md): the amounts and dates from the list row at once, then its items and payments once
 * they load. Working on the invoice (items, checking, editing) stays on its own page; Pay is the list's own dialog.
 */
@Component({
    selector: 'app-invoice-peek',
    template: `
    <app-peek [open]="!!invoice" [title]="heading" [subtitle]="subtitle" testid="ipeek" [loading]="false" [error]="error"
      [fullPage]="invoice ? ['/secure/purchases/invoices/items', invoice.id] : null" fullPageLabel="Open invoice" (closed)="closed.emit()" (retry)="load()">
      <span badges *ngIf="invoice"><span class="badge ms-1" [ngClass]="payClass">{{invoice.payment_status}}</span></span>
      <button actions type="button" class="btn btn-sm btn-primary" *ngIf="invoice && canPay" (click)="pay.emit(invoice)" data-testid="ipeek-pay">Pay</button>

      <ng-container *ngIf="invoice">
        <div class="row g-2 mb-3" data-testid="ipeek-money">
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Amount</div><div class="h6 mb-0">{{invoice.total | number:'1.2-2'}}</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Paid</div><div class="h6 mb-0">{{invoice.paid_amount | number:'1.2-2'}}</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Balance</div><div class="h6 mb-0" [class.text-danger]="invoice.days_overdue > 0">{{invoice.balance_amount | number:'1.2-2'}}</div></div></div>
        </div>
        <dl class="row mb-2 small">
          <dt class="col-4">Invoice date</dt><dd class="col-8">{{invoice.invoice_date | date:'dd MMM yyyy'}}</dd>
          <dt class="col-4">Due</dt><dd class="col-8">{{invoice.due_date ? (invoice.due_date | date:'dd MMM yyyy') : '-'}}<span class="text-danger" *ngIf="invoice.days_overdue > 0"> &middot; {{invoice.days_overdue}} day{{invoice.days_overdue === 1 ? '' : 's'}} late</span></dd>
          <dt class="col-4">Vendor</dt><dd class="col-8">{{invoice.business_name}}</dd>
          <dt class="col-4" *ngIf="invoice.last_payment">Last payment</dt><dd class="col-8" *ngIf="invoice.last_payment">{{invoice.last_payment | date:'dd MMM yyyy'}}</dd>
        </dl>

        <app-section title="Items" [count]="items.length" [open]="true" testid="ipeek-items">
          <div class="text-muted small" *ngIf="loadingFull">Loading the items...</div>
          <div class="text-muted small" *ngIf="!loadingFull && !items.length">No items entered.</div>
          <div class="table-responsive" *ngIf="items.length"><table class="table table-sm mb-0 small">
            <thead><tr><th>Product</th><th>Batch</th><th class="text-end">Qty</th><th class="text-end">Total</th></tr></thead>
            <tbody><tr *ngFor="let i of items"><td>{{i.product?.title || '-'}}</td><td>{{i.batch || '-'}}</td><td class="text-end">{{i.qty}}<span class="text-muted" *ngIf="i.freeqty"> +{{i.freeqty}}</span></td><td class="text-end">{{i.total | number:'1.2-2'}}</td></tr></tbody></table></div>
        </app-section>

        <app-section title="Payments" [count]="payments.length" [open]="payments.length > 0 && payments.length <= 5" testid="ipeek-payments">
          <div class="text-muted small" *ngIf="!loadingFull && !payments.length">No payment recorded.</div>
          <table class="table table-sm mb-0 small" *ngIf="payments.length"><tbody><tr *ngFor="let p of payments"><td>{{p.paydate | date:'dd MMM yyyy'}}</td><td class="text-end">{{p.amount | number:'1.2-2'}}</td></tr></tbody></table>
        </app-section>
      </ng-container>
    </app-peek>`
})
export class InvoicePeekComponent implements OnChanges {
    /** the invoice row from the list (null = closed) */
    @Input() invoice: any = null;
    @Input() canPay = false;
    @Output() closed = new EventEmitter<void>();
    @Output() pay = new EventEmitter<any>();

    full: any = null;
    loadingFull = false;
    error = '';
    private seq = 0;

    constructor(private service: InvoiceService) {}

    get heading(): string {
        const i = this.invoice;
        return i ? (i.invoice_no ? `Invoice ${i.invoice_no}` : i.challan_no ? `Challan ${i.challan_no}` : 'Draft invoice') : '';
    }
    get subtitle(): string { return this.invoice ? (this.invoice.business_name || '') : ''; }
    get items(): any[] { return this.full?.items || []; }
    get payments(): any[] { return this.full?.payments || []; }
    get payClass(): string {
        const s = this.invoice?.payment_status;
        return s === 'Paid' ? 'bg-success' : s === 'Overdue' ? 'bg-danger' : s === 'On Hold' ? 'bg-secondary' : 'bg-warning text-dark';
    }

    /** reload only when a different invoice is opened, not when the list refreshes the same one */
    ngOnChanges(c: SimpleChanges) {
        if (!c['invoice']) return;
        const was = c['invoice'].previousValue?.id, now = c['invoice'].currentValue?.id;
        if (was !== now) this.load();
    }

    load() {
        const id = this.invoice?.id;
        this.full = null; this.error = '';
        if (!id) { this.loadingFull = false; return; }
        const mine = ++this.seq;
        this.loadingFull = true;
        this.service.find(id).subscribe(
            (r: any) => { if (mine === this.seq) { this.full = r; this.loadingFull = false; } },
            () => { if (mine === this.seq) { this.loadingFull = false; this.error = 'The items could not be loaded.'; } });
    }
}

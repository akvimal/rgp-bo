import { HttpClient } from "@angular/common/http";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { environment } from "src/environments/environment";

/**
 * The earlier purchases of a product, in a dialog opened from a line of a purchase invoice: date, invoice (or challan) number, vendor, batch, expiry,
 * quantity, free, MRP, rate, discount and tax, newest first, with the last, lowest and highest net rate paid. Received invoices only; the invoice the line
 * belongs to is left out. Purchases from this invoice's vendor are marked, so a rate can be read against what the vendor charged before.
 */
@Component({
  selector: "app-purchase-history",
  template: `
    <p-dialog [visible]="!!product" (visibleChange)="!$event && close()" [modal]="true" [draggable]="false" [dismissableMask]="true" [baseZIndex]="1000"
              [style]="{width: '64rem', maxWidth: '96vw'}" header="Purchase history" styleClass="purchase-history">
      <div *ngIf="product" data-testid="purchase-history">
        <h5 class="mb-2" data-testid="ph-title">{{product.title}}</h5>

        <div class="alert alert-danger py-2" *ngIf="error" data-testid="ph-error">{{error}}</div>
        <div class="text-muted small" *ngIf="loading" data-testid="ph-loading">Loading the purchases...</div>

        <ng-container *ngIf="data">
          <div class="text-muted small py-2" *ngIf="!data.lines.length" data-testid="ph-empty">No earlier purchase of this product on a received invoice.</div>

          <ng-container *ngIf="data.lines.length">
            <div class="d-flex flex-wrap gap-3 small mb-2" data-testid="ph-summary">
              <span *ngIf="data.summary.last">Last paid <strong>{{data.summary.last.rate | number:'1.2-2'}}</strong><span class="text-muted ms-1">{{data.summary.last.vendor}}, {{data.summary.last.date | date:'dd MMM yyyy'}}</span></span>
              <span *ngIf="data.summary.lowest">Lowest <strong>{{data.summary.lowest.rate | number:'1.2-2'}}</strong><span class="text-muted ms-1">{{data.summary.lowest.vendor}}</span></span>
              <span *ngIf="data.summary.highest">Highest <strong>{{data.summary.highest.rate | number:'1.2-2'}}</strong><span class="text-muted ms-1">{{data.summary.highest.vendor}}</span></span>
              <span class="text-muted">Net rate is the rate less the discount.</span>
            </div>
            <p-table [value]="data.lines" [paginator]="data.lines.length > 10" [rows]="10" styleClass="p-datatable-gridlines p-datatable-sm">
              <ng-template pTemplate="header">
                <tr>
                  <th>Date</th><th>Inv no.</th><th>Vendor</th><th>Batch</th><th class="text-center">Exp</th>
                  <th class="text-end">Qty</th><th class="text-end">Free</th><th class="text-end">MRP</th><th class="text-end">Rate</th>
                  <th class="text-end">Disc</th><th class="text-end">Tax</th><th class="text-end" title="The rate less the discount">Net rate</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-l>
                <tr data-testid="ph-row" [class.table-info]="l.same_vendor">
                  <td class="text-nowrap">{{l.invoice_date | date:'dd MMM yyyy'}}</td>
                  <td>{{l.doc_no || '-'}}</td>
                  <td>{{l.vendor || '-'}} <span class="badge bg-info text-dark" *ngIf="l.same_vendor" title="The vendor of this invoice">this vendor</span></td>
                  <td>{{l.batch}}</td>
                  <td class="text-center text-nowrap">{{l.exp_date ? (l.exp_date | date:'MMM-yy') : '-'}}</td>
                  <td class="text-end">{{l.qty}}</td>
                  <td class="text-end">{{l.free_qty || 0}}</td>
                  <td class="text-end">{{l.mrp_cost | number:'1.2-2'}}</td>
                  <td class="text-end">{{l.ptr_value | number:'1.2-2'}}</td>
                  <td class="text-end">{{l.disc_pcnt || 0}}%</td>
                  <td class="text-end">{{l.tax_pcnt || 0}}%</td>
                  <td class="text-end fw-semibold">{{l.net_rate | number:'1.2-2'}}</td>
                </tr>
              </ng-template>
            </p-table>
            <div class="small text-muted mt-1" *ngIf="data.lines.length >= data.limit">The latest {{data.limit}} purchases are shown.</div>
          </ng-container>
        </ng-container>
      </div>
    </p-dialog>`
})
export class PurchaseHistoryComponent implements OnChanges {
  /** the product to show (null = closed) */
  @Input() product: { id: number; title: string } | null = null;
  /** the invoice the line belongs to: it is left out, and its vendor is marked in the list */
  @Input() invoiceId: number | null = null;
  @Output() closed = new EventEmitter<void>();

  data: any = null;
  loading = false;
  error = "";

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["product"]) this.load();
  }

  private load() {
    this.data = null;
    this.error = "";
    this.loading = false;
    if (!this.product) return;
    const id = this.product.id;
    this.loading = true;
    const url = `${environment.apiHost}/purchaseitems/history/${id}`;
    this.http.get<any>(url, { params: this.invoiceId ? { exclude: String(this.invoiceId) } : {} }).subscribe({
      next: (d) => {
        if (!this.product || this.product.id !== id) return;                 // another product was chosen meanwhile
        this.data = { lines: d?.lines || [], summary: d?.summary || {}, limit: d?.limit || 100 };
        this.loading = false;
      },
      error: (e) => {
        if (!this.product || this.product.id !== id) return;
        this.loading = false;
        this.error = e?.status === 403 ? "You do not have access to purchase history." : (e?.error?.message || "The purchase history could not be loaded.");
      }
    });
  }

  close() { this.closed.emit(); }
}

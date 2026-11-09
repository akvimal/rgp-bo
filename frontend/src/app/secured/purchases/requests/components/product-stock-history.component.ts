import { HttpClient } from "@angular/common/http";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { environment } from "src/environments/environment";

/**
 * A product's stock history in a dialog: what was bought (batch by batch, with what was sold, adjusted and is left), how it sold month by month,
 * and who bought it. The same three tabs as the panel on Stock > Products, read-only, so a buyer can look at the history of a product on Reorder without leaving
 * the list. It comes from the stock endpoint, which needs the permission to see costs; without it the panel says so.
 */
@Component({
  selector: "app-product-stock-history",
  template: `
    <p-dialog [visible]="!!product" (visibleChange)="!$event && close()" [modal]="true" [draggable]="false" [dismissableMask]="true" [baseZIndex]="1000"
              [style]="{width: '48rem', maxWidth: '96vw'}" [header]="'Stock history'" styleClass="stock-history">
      <div *ngIf="product" data-testid="stock-history">
        <h5 class="mb-2" data-testid="sh-title">{{product.title}}</h5>

        <div class="alert alert-danger py-2" *ngIf="error" data-testid="sh-error">{{error}}</div>
        <div class="text-muted small" *ngIf="loading" data-testid="sh-loading">Loading the history...</div>

        <ng-container *ngIf="data">
          <div class="d-flex flex-wrap gap-3 small mb-2" data-testid="sh-totals">
            <span>Bought <strong>{{totals.purchased}}</strong></span>
            <span>Sold <strong>{{totals.sold}}</strong></span>
            <span>Adjusted <strong>{{totals.adjusted}}</strong></span>
            <span>Balance <strong>{{totals.balance}}</strong></span>
          </div>
          <p-tabView>
            <p-tabPanel header="Purchase">
              <div class="text-muted small py-2" *ngIf="!data.purchases?.length" data-testid="sh-no-purchases">Nothing has been bought for this product yet.</div>
              <p-table *ngIf="data.purchases?.length" [value]="data.purchases" [paginator]="true" [rows]="10" [showCurrentPageReport]="true"
                       styleClass="p-datatable-gridlines p-datatable-sm" currentPageReportTemplate="{totalRecords} Items" [rowsPerPageOptions]="[10,25,50]">
                <ng-template pTemplate="header">
                  <tr><th>Date</th><th>Inv No.</th><th>Batch</th><th>Exp Date</th><th class="text-end">Buy</th><th class="text-end">Sel</th><th class="text-end">Adj</th><th class="text-end">Bal</th></tr>
                </ng-template>
                <ng-template pTemplate="body" let-i>
                  <tr [ngClass]="{'expired': i.expired == true}" data-testid="sh-purchase-row">
                    <td>{{i.invoice_date | date : 'dd MMM yyyy'}}</td>
                    <td>{{i.invoice_no}}</td>
                    <td>{{i.batch}}</td>
                    <td>{{i.exp_date | date : 'MMM-yy'}}</td>
                    <td class="text-end">{{i.purchased}}</td>
                    <td class="text-end">{{i.sold}}</td>
                    <td class="text-end">{{i.adjusted}}</td>
                    <td class="text-end">{{i.balance}}</td>
                  </tr>
                </ng-template>
              </p-table>
            </p-tabPanel>
            <p-tabPanel header="Sale">
              <div class="text-muted small py-2" *ngIf="!data.sales?.length" data-testid="sh-no-sales">Nothing has been sold yet.</div>
              <p-table *ngIf="data.sales?.length" [value]="data.sales" [paginator]="true" [rows]="10" [showCurrentPageReport]="true"
                       styleClass="p-datatable-gridlines p-datatable-sm" currentPageReportTemplate="{totalRecords} Items" [rowsPerPageOptions]="[10,25,50]">
                <ng-template pTemplate="header"><tr><th>Month</th><th class="text-end">Orders</th><th class="text-end">Qty</th></tr></ng-template>
                <ng-template pTemplate="body" let-i>
                  <tr [ngClass]="{'expired': i.long == true}" data-testid="sh-sale-row">
                    <td>{{i.sale_month | date : 'MMM-yy'}}</td>
                    <td class="text-end">{{i.total_orders}}</td>
                    <td class="text-end">{{i.total_qty}}</td>
                  </tr>
                </ng-template>
              </p-table>
            </p-tabPanel>
            <p-tabPanel header="Customer">
              <div class="text-muted small py-2" *ngIf="!data.customers?.length" data-testid="sh-no-customers">No customer has bought it yet.</div>
              <p-table *ngIf="data.customers?.length" [value]="data.customers" [paginator]="true" [rows]="10" [showCurrentPageReport]="true"
                       styleClass="p-datatable-gridlines p-datatable-sm" currentPageReportTemplate="{totalRecords} Items" [rowsPerPageOptions]="[10,25,50]">
                <ng-template pTemplate="header"><tr><th>Month</th><th>Name</th><th>Mobile</th><th class="text-end">Qty</th><th class="text-end">Last Sold</th></tr></ng-template>
                <ng-template pTemplate="body" let-i>
                  <tr [ngClass]="{'expired': i.long == true}" data-testid="sh-customer-row">
                    <td>{{i.sale_month | date : 'MMM-yy'}}</td>
                    <td>{{i.name}}</td>
                    <td>{{i.mobile}}</td>
                    <td class="text-end">{{i.total_qty}}</td>
                    <td class="text-end">{{i.recent | date : 'dd MMM yyyy'}}</td>
                  </tr>
                </ng-template>
              </p-table>
            </p-tabPanel>
          </p-tabView>
          <div class="small text-muted mt-1">Rows in a faded colour are batches past their expiry, or months more than six months back.</div>
        </ng-container>
      </div>
    </p-dialog>`
})
export class ProductStockHistoryComponent implements OnChanges {
  /** the product to show (null = closed) */
  @Input() product: { id: number; title: string } | null = null;
  @Output() closed = new EventEmitter<void>();

  data: any = null;
  loading = false;
  error = "";

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["product"]) this.load();
  }

  /** what is bought, sold, adjusted and left over all the batches */
  get totals() {
    const sum = (k: string) => (this.data?.purchases || []).reduce((a: number, p: any) => a + (Number(p[k]) || 0), 0);
    return { purchased: sum("purchased"), sold: sum("sold"), adjusted: sum("adjusted"), balance: sum("balance") };
  }

  private load() {
    this.data = null;
    this.error = "";
    this.loading = false;
    if (!this.product) return;
    const id = this.product.id;
    this.loading = true;
    this.http.get<any>(`${environment.apiHost}/stock2/${id}`).subscribe({
      next: (d) => {
        if (!this.product || this.product.id !== id) return;                 // another product was chosen meanwhile
        const old = (date: any) => (Date.now() - new Date(date).getTime()) / 86400000 > 180;
        // a product never bought comes back as one empty row: that is no purchase
        d.purchases = (d.purchases || []).filter((p: any) => p.invoice_no || p.batch || (p.purchased !== null && p.purchased !== undefined));
        (d.sales || []).forEach((s: any) => s.long = old(s.sale_month));
        (d.customers || []).forEach((c: any) => c.long = old(c.sale_month));
        this.data = d;
        this.loading = false;
      },
      error: (e) => {
        if (!this.product || this.product.id !== id) return;
        this.loading = false;
        this.error = e?.status === 403 ? "You do not have access to a product's stock history." : (e?.error?.message || "The history could not be loaded.");
      }
    });
  }

  close() { this.closed.emit(); }
}

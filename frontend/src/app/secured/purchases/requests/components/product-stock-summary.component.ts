import { HttpClient } from "@angular/common/http";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { environment } from "src/environments/environment";

/**
 * A one-glance stock summary for a product picked on a form: what is on hand (batches not past expiry), what was bought and when it was last
 * bought, how much sold last month. Read from the stock endpoint; a person without access to it simply sees nothing.
 * "History" asks the page to open the full stock history dialog.
 */
@Component({
  selector: "app-product-stock-summary",
  template: `
    <div *ngIf="summary" class="border rounded bg-light px-3 py-2 small d-flex flex-wrap gap-x-3 gap-2 align-items-center" data-testid="stock-summary">
      <span>In stock <strong data-testid="ss-onhand">{{summary.onhand}}</strong></span>
      <span *ngIf="summary.expired">Expired <strong>{{summary.expired}}</strong></span>
      <span>Bought (all batches) <strong>{{summary.bought}}</strong></span>
      <span>Last bought <strong>{{summary.lastbought ? (summary.lastbought | date:'dd MMM yyyy') : 'never'}}</strong><span *ngIf="summary.lastinvoice" class="text-muted"> (inv {{summary.lastinvoice}})</span></span>
      <span *ngIf="summary.lastsalemonth">Sold {{summary.lastsalemonth | date:'MMM-yy'}} <strong>{{summary.lastsaleqty}}</strong></span>
      <a role="button" class="ms-auto" (click)="history.emit()" data-testid="ss-history"><i class="bi bi-clock-history me-1"></i>Purchase history</a>
    </div>
    <div *ngIf="loading" class="small text-muted" data-testid="ss-loading">Loading stock...</div>`
})
export class ProductStockSummaryComponent implements OnChanges {
  @Input() productId: number | null = null;
  @Output() history = new EventEmitter<void>();

  summary: any = null;
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["productId"]) this.load();
  }

  private load() {
    this.summary = null;
    this.loading = false;
    const id = this.productId;
    if (!id) return;
    this.loading = true;
    this.http.get<any>(`${environment.apiHost}/stock2/${id}`).subscribe({
      next: (d) => {
        if (this.productId !== id) return;
        this.loading = false;
        const rows = (d.purchases || []).filter((p: any) => p.invoice_no || p.batch || (p.purchased !== null && p.purchased !== undefined));
        const num = (v: any) => Number(v) || 0;
        const last = rows.slice().sort((a: any, b: any) => String(b.invoice_date || '').localeCompare(String(a.invoice_date || '')))[0];
        const sales = (d.sales || []).slice().sort((a: any, b: any) => String(b.sale_month || '').localeCompare(String(a.sale_month || '')))[0];
        this.summary = {
          onhand: rows.filter((p: any) => !p.expired).reduce((a: number, p: any) => a + num(p.balance), 0),
          expired: rows.filter((p: any) => p.expired).reduce((a: number, p: any) => a + num(p.balance), 0),
          bought: rows.reduce((a: number, p: any) => a + num(p.purchased), 0),
          lastbought: last?.invoice_date || null,
          lastinvoice: last?.invoice_no || '',
          lastsalemonth: sales?.sale_month || null,
          lastsaleqty: sales ? num(sales.total_qty) : 0
        };
      },
      error: () => { if (this.productId === id) { this.loading = false; this.summary = null; } }   // no access or no data: show nothing
    });
  }
}

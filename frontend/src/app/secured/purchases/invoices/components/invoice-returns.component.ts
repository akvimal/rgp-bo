import { Component, EventEmitter, Input, OnChanges, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

/**
 * Goods sent back to this vendor earlier, credited on this invoice: the vendor's "returned items" lines. Each return picked here comes off what
 * the invoice comes to (the server keeps the total, and refuses a credit bigger than the goods bought).
 */
@Component({
  selector: "app-invoice-returns",
  template: `
    <div class="card mt-3" data-testid="invoice-returns" *ngIf="data && (data.applied.length || data.open.length)">
      <div class="card-body">
        <h6 class="mb-2">Returns the vendor credited on this invoice</h6>
        <div class="alert alert-danger py-2" *ngIf="error" data-testid="invoice-returns-error">{{error}}</div>
        <table class="table table-sm align-middle mb-2" *ngIf="data.applied.length">
          <thead><tr><th>Return</th><th>Date</th><th>Items</th><th class="text-end">Credited</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let c of data.applied" data-testid="invoice-credit-row">
              <td>#{{c.returnno || c.returnid}}<div class="small text-muted" *ngIf="c.reason">{{c.reason}}</div><div class="small text-muted" *ngIf="c.frominvoices" data-testid="invoice-credit-from">from invoice {{c.frominvoices}}</div></td>
              <td>{{c.returndate}}</td>
              <td class="small">{{c.summary}}</td>
              <td class="text-end">&minus; {{c.amount | number:'1.2-2'}}<div class="small text-muted" *ngIf="c.amount !== c.returntotal">returned worth {{c.returntotal | number:'1.2-2'}}</div></td>
              <td class="text-end"><button type="button" class="btn btn-outline-danger btn-sm py-0" *ngIf="data.editable" (click)="remove(c)" data-testid="invoice-credit-remove">Take off</button></td>
            </tr>
          </tbody>
          <tfoot><tr class="fw-semibold"><td colspan="3" class="text-end">Returns adjusted</td><td class="text-end">&minus; {{appliedTotal | number:'1.2-2'}}</td><td></td></tr></tfoot>
        </table>
        <ng-container *ngIf="data.editable && data.open.length">
          <div class="small text-muted mb-1">Open returns to this vendor, not yet credited on any invoice:</div>
          <div class="d-flex flex-wrap gap-2 align-items-center mb-1" *ngFor="let r of data.open" data-testid="invoice-open-return">
            <span class="me-2">#{{r.returnno || r.id}} &middot; {{r.returndate}} &middot; <span class="small">{{r.summary}}</span><span class="small text-muted" *ngIf="r.frominvoices"> (from invoice {{r.frominvoices}})</span> &middot; <b>{{r.total | number:'1.2-2'}}</b></span>
            <input type="number" min="0" step="0.01" class="form-control form-control-sm" style="width:8rem" [(ngModel)]="amounts[r.id]" placeholder="credited" title="What the vendor credited for it, if different" data-testid="invoice-credit-amount">
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="add(r)" [disabled]="busy" data-testid="invoice-credit-add">Adjust on this invoice</button>
          </div>
        </ng-container>
      </div>
    </div>`
})
export class InvoiceReturnsComponent implements OnChanges {
  @Input() invoiceid!: number;
  @Input() status = "NEW";
  @Input() reload = 0;
  /** the total of the returns adjusted, and that something changed (so the invoice total is read again) */
  @Output() applied = new EventEmitter<number>();
  @Output() changed = new EventEmitter<void>();

  data: any = null;
  amounts: { [id: number]: any } = {};
  error = "";
  busy = false;

  constructor(private http: HttpClient) {}

  get appliedTotal(): number { return (this.data?.applied || []).reduce((s: number, c: any) => s + (+c.amount || 0), 0); }

  ngOnChanges() { this.load(); }

  load() {
    if (!this.invoiceid) return;
    this.http.get<any>(`${environment.apiHost}/vendor-returns/invoice/${this.invoiceid}`).subscribe(d => { this.data = d; this.applied.emit(this.appliedTotal); }, () => this.data = null);
  }

  private failed(e: any, fallback: string) { const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || fallback); this.busy = false; }

  add(r: any) {
    this.error = ""; this.busy = true;
    const amt = this.amounts[r.id];
    this.http.post(`${environment.apiHost}/vendor-returns/invoice/${this.invoiceid}`, { returnid: r.id, amount: amt === undefined || amt === null || amt === "" ? undefined : +amt }).subscribe(
      () => { this.busy = false; delete this.amounts[r.id]; this.load(); this.changed.emit(); }, e => this.failed(e, "Could not adjust the return."));
  }

  remove(c: any) {
    this.error = "";
    this.http.delete(`${environment.apiHost}/vendor-returns/invoice/${this.invoiceid}/${c.id}`).subscribe(
      () => { this.load(); this.changed.emit(); }, e => this.failed(e, "Could not take the return off."));
  }
}

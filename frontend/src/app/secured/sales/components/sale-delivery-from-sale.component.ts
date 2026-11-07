import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";

/**
 * "New delivery" on the Deliveries page: pick a bill that was rung up as a counter sale and make it a delivery. Used for a phone order that was
 * billed first and arranged for delivery later. A bill already handed over at the counter can simply be left alone: nothing here forces it.
 */
@Component({
  selector: "app-sale-delivery-from-sale",
  template: `
    <p-dialog header="New delivery from a bill" [visible]="open" (visibleChange)="!$event && close()" [modal]="true" [style]="{width: '44rem'}" [draggable]="false">
      <div data-testid="dfs">
        <p class="small text-muted mb-2">Pick a recent bill that was taken as a counter sale. The bill is already paid (or left to pay later), so nothing is collected at the door.</p>
        <div class="row g-2 mb-2">
          <div class="col-8"><input class="form-control" placeholder="Bill no., customer name or mobile" [(ngModel)]="q" (ngModelChange)="load()" data-testid="dfs-q"></div>
          <div class="col-4">
            <select class="form-select" [(ngModel)]="days" (ngModelChange)="load()" data-testid="dfs-days">
              <option [ngValue]="1">Today</option><option [ngValue]="3">Last 3 days</option><option [ngValue]="7">Last 7 days</option><option [ngValue]="30">Last 30 days</option>
            </select>
          </div>
        </div>
        <div class="alert alert-danger py-2" *ngIf="error">{{error}}</div>
        <table class="table table-sm table-hover mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th class="text-end">Total</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let b of rows" data-testid="dfs-row">
              <td>{{b.billno}}<div class="small text-muted">{{b.ordertype}}</div></td>
              <td class="text-nowrap">{{b.billdate | date:'dd MMM, h:mm a'}}</td>
              <td>{{b.custname || 'Walk-in'}}<div class="small text-muted">{{b.custmobile}}</div></td>
              <td class="text-end">{{b.total | number:'1.2-2'}}</td>
              <td class="text-end"><button type="button" class="btn btn-sm btn-outline-primary" (click)="pick = b" data-testid="dfs-pick">Make delivery</button></td>
            </tr>
            <tr *ngIf="!rows.length"><td colspan="5" class="text-center text-muted py-3">{{loading ? 'Looking...' : 'No counter bills found for this period.'}}</td></tr>
          </tbody>
        </table>
      </div>
    </p-dialog>
    <app-sale-delivery-mode [sale]="pick" (closed)="pick = null; $event && done()"></app-sale-delivery-mode>`
})
export class SaleDeliveryFromSaleComponent implements OnChanges {
  @Input() open = false;
  @Output() closed = new EventEmitter<boolean>();

  rows: any[] = [];
  q = "";
  days = 3;
  loading = false;
  error = "";
  pick: any = null;
  private changed = false;

  constructor(private http: HttpClient, private storeContext: StoreContextService) {}

  ngOnChanges(c: SimpleChanges) {
    if (c["open"] && this.open) { this.q = ""; this.changed = false; this.pick = null; this.load(); }
  }

  load() {
    this.loading = true; this.error = "";
    const params: any = { days: String(this.days) };
    if (this.q.trim()) params.q = this.q.trim();
    const store = this.storeContext.selectedStoreId;
    if (store !== null && store !== undefined) params.storeid = String(store);
    this.http.get<any[]>(`${environment.apiHost}/deliveries/candidates`, { params }).subscribe(
      r => { this.rows = r || []; this.loading = false; },
      e => { this.rows = []; this.loading = false; this.error = e?.error?.message || "The bills could not be loaded."; });
  }

  /** the bill became a delivery: it leaves the list, and the Deliveries page refreshes when this closes */
  done() { this.changed = true; this.load(); }

  close() { this.closed.emit(this.changed); }
}

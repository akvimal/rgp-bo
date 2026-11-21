import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { AuthService } from "src/app/@core/auth/auth.service";
import { StoreContextService } from "src/app/@core/store-context.service";

/**
 * The bills left to pay later that are still open, for the till: who owes what on which bill, the overdue first, and a Collect action.
 * Money collected is set against the customer's oldest bill first (as on the customer's Dues tab) and goes into the shift that is open.
 */
@Component({
  selector: "app-sale-pay-later",
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 my-2">
      <h5 class="mb-0">Pay later bills</h5>
      <input class="form-control form-control-sm ms-3" style="width:15rem" placeholder="Search name, mobile or bill no" [(ngModel)]="q" aria-label="Search" data-testid="later-search">
      <div class="form-check ms-2 mb-0"><input class="form-check-input" type="checkbox" id="later-late" [(ngModel)]="lateOnly" data-testid="later-late-only"><label class="form-check-label small" for="later-late">Overdue only</label></div>
      <span class="ms-auto text-muted small" data-testid="later-total">{{shown.length}} bill(s) &middot; left &#8377;{{leftTotal | number:'1.2-2'}}<span *ngIf="lateTotal > 0" class="text-danger"> &middot; overdue &#8377;{{lateTotal | number:'1.2-2'}}</span></span>
    </div>
    <div *ngIf="error" class="alert alert-danger py-2">{{error}}</div>
    <div *ngIf="done" class="alert alert-success py-2" data-testid="later-done">{{done}}</div>

    <div class="hist-card" *ngIf="shown.length; else none">
      <table class="table table-sm table-hover mb-0" data-testid="later-table">
        <thead><tr><th>Bill</th><th>Bill date</th><th>Customer</th><th>Mobile</th><th>Promised for</th><th class="text-end">Left on bill</th><th class="text-end">Customer owes</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of shown" data-testid="later-row" [class.table-danger]="r.overdue">
            <td><a *ngIf="r.sale_id" [routerLink]="['/secure/sales/pos/view', r.sale_id]">#{{r.bill_no || r.sale_id}}</a><span *ngIf="!r.sale_id" class="text-muted">Adjustment</span></td>
            <td>{{r.bill_date | date:'dd MMM yyyy'}}</td>
            <td class="fw-semibold">{{r.name}}<div class="small text-muted fw-normal" *ngIf="r.locality">{{r.locality}}</div></td>
            <td>{{r.mobile && r.mobile !== '0000000000' ? r.mobile : 'no mobile'}}</td>
            <td>{{r.due_date | date:'dd MMM yyyy'}}<span *ngIf="r.overdue" class="text-danger small"> &middot; {{r.days_late}} day(s) late</span></td>
            <td class="text-end">&#8377;{{r.left | number:'1.2-2'}}</td>
            <td class="text-end">&#8377;{{r.owes | number:'1.2-2'}}</td>
            <td class="text-end"><button type="button" class="btn btn-sm btn-primary" *ngIf="canCollect" (click)="open(r)" data-testid="later-collect">Collect</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #none><div class="hist-empty"><i class="bi bi-check-circle"></i>{{loaded ? 'No pay later bills are waiting.' : 'Loading...'}}</div></ng-template>

    <p-dialog [header]="'Collect from ' + (row?.name || '')" [(visible)]="showDialog" [modal]="true" [style]="{width:'30rem'}" (onHide)="row = null">
      <div *ngIf="row" data-testid="later-dialog">
        <div class="small text-muted mb-2">
          {{row.bill_no ? 'Bill #' + row.bill_no + ' has' : 'This has'}} &#8377;{{row.left | number:'1.2-2'}} left; {{row.name}} owes &#8377;{{row.owes | number:'1.2-2'}} in all.
          Money collected is set against their oldest bill first.
        </div>
        <div class="alert alert-danger py-2" *ngIf="dialogError">{{dialogError}}</div>
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Amount (&#8377;)</label><input type="number" min="0" class="form-control" [(ngModel)]="pay.amount" data-testid="later-amount"></div>
          <div class="col-6"><label class="form-label">How</label>
            <select class="form-select" [(ngModel)]="pay.mode" data-testid="later-mode"><option value="CASH">Cash</option><option value="DIGITAL">Digital</option></select></div>
          <div class="col-12" *ngIf="pay.mode === 'DIGITAL'"><label class="form-label">Reference no (optional)</label><input class="form-control" maxlength="40" [(ngModel)]="pay.refno"></div>
          <div class="col-12"><label class="form-label">Note (optional)</label><input class="form-control" maxlength="200" [(ngModel)]="pay.note"></div>
          <div class="col-12 d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="pay.amount = row.left">This bill &#8377;{{row.left | number:'1.2-2'}}</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" *ngIf="row.owes > row.left" (click)="pay.amount = row.owes">All &#8377;{{row.owes | number:'1.2-2'}}</button>
          </div>
        </div>
        <div class="small text-muted mt-2">Cash goes into the drawer of the shift that is open now; digital goes with the day's digital total.</div>
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="button" class="btn btn-outline-secondary" (click)="showDialog = false">Cancel</button>
          <button type="button" class="btn btn-primary" (click)="collect()" [disabled]="saving" data-testid="later-save">Collect</button>
        </div>
      </div>
    </p-dialog>`
})
export class SalePayLaterComponent implements OnInit {
  rows: any[] = [];
  q = "";
  lateOnly = false;
  loaded = false;
  error = "";
  done = "";
  canCollect = false;

  showDialog = false;
  row: any = null;
  saving = false;
  dialogError = "";
  pay: any = { amount: null, mode: "CASH", refno: "", note: "" };

  constructor(private http: HttpClient, auth: AuthService, private storeContext: StoreContextService) {
    this.canCollect = auth.isActionAuthorized("customers.dues.collect");     // the owner roles hold this by name; the server checks as well
  }

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any[]>(`${environment.apiHost}/customer-dues/owing/bills`).subscribe(
      r => { this.rows = r || []; this.loaded = true; },
      e => { this.loaded = true; this.error = this.message(e, "Could not load the pay later bills."); });
  }

  get shown() {
    const q = this.q.trim().toLowerCase();
    return this.rows.filter(r => (!this.lateOnly || r.overdue)
      && (!q || String(r.name || "").toLowerCase().includes(q) || String(r.mobile || "").includes(q) || String(r.bill_no ?? "").includes(q)));
  }
  get leftTotal() { return this.shown.reduce((s, r) => s + r.left, 0); }
  get lateTotal() { return this.shown.filter(r => r.overdue).reduce((s, r) => s + r.left, 0); }

  open(r: any) {
    this.row = r; this.dialogError = ""; this.done = "";
    this.pay = { amount: r.left, mode: "CASH", refno: "", note: "" };
    this.showDialog = true;
  }

  collect() {
    if (!this.row) return;
    this.dialogError = ""; this.saving = true;
    const name = this.row.name;
    this.http.post<any>(`${environment.apiHost}/customer-dues/${this.row.customer_id}/payment`,
      { ...this.pay, storeid: this.storeContext.selectedStoreId }).subscribe(
      () => { this.saving = false; this.showDialog = false; this.done = `Collected from ${name}.`; this.load(); },
      e => { this.saving = false; this.dialogError = this.message(e, "Could not record the payment."); });
  }

  private message(e: any, fallback: string) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || fallback); }
}

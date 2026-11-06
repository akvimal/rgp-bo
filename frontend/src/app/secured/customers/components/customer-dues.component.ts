import { Component, Input, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { AuthService } from "../../../@core/auth/auth.service";
import { StoreContextService } from "../../../@core/store-context.service";

/**
 * What a customer owes for bills left to pay later: the balance, the credit limit, what is overdue and the history. Money collected goes into the
 * shift that is open; a Store Head or Business Head sets the limit; the Business Head corrects the balance with a reason.
 */
@Component({
  selector: "app-customer-dues",
  template: `
    <div class="hist-balance">
      <div><div class="hist-label">Owes</div><div class="hist-amount" data-testid="due-balance">&#8377;{{d?.balance | number:'1.2-2'}}</div></div>
      <div><div class="hist-label">Credit limit</div><div class="hist-amount" data-testid="due-limit">&#8377;{{d?.limit | number:'1.0-0'}}</div></div>
      <div *ngIf="d?.overdue?.amount > 0"><div class="hist-label text-danger">Overdue</div>
        <div class="hist-amount text-danger" data-testid="due-overdue">&#8377;{{d.overdue.amount | number:'1.2-2'}}</div></div>
      <span class="hist-hint">Bills left to pay later. The credit limit is what they may owe at most; 0 means no credit.</span>
    </div>
    <div *ngIf="error" class="alert alert-danger py-2">{{error}}</div>

    <div class="hist-card mb-3" *ngIf="d?.open?.length">
      <div class="hist-card-head">Still to pay</div>
      <table class="table table-sm mb-0" data-testid="due-open">
        <thead><tr><th>Promised for</th><th class="text-end">Left</th></tr></thead>
        <tbody><tr *ngFor="let o of d.open" [class.text-danger]="o.due_date < today"><td>{{o.due_date | date:'dd MMM yyyy'}}<span *ngIf="o.due_date < today"> (overdue)</span></td><td class="text-end">&#8377;{{o.remaining | number:'1.2-2'}}</td></tr></tbody>
      </table>
    </div>

    <div class="hist-card mb-3" *ngIf="d?.balance > 0">
      <div class="hist-card-head">Collect a payment</div>
      <div class="hist-card-body row g-2 align-items-end">
        <div class="col-md-2"><label class="form-label">Amount (&#8377;)</label><input type="number" min="0" class="form-control" [(ngModel)]="pay.amount" data-testid="due-pay-amount"></div>
        <div class="col-md-2"><label class="form-label">How</label>
          <select class="form-select" [(ngModel)]="pay.mode" data-testid="due-pay-mode"><option value="CASH">Cash</option><option value="DIGITAL">Digital</option></select></div>
        <div class="col-md-3"><label class="form-label">Note (optional)</label><input class="form-control" maxlength="200" [(ngModel)]="pay.note"></div>
        <div class="col-md-2"><button class="btn btn-primary w-100" type="button" (click)="collect()" [disabled]="saving" data-testid="due-pay-save">Collect</button></div>
        <div class="col-12 small text-muted">Cash goes into the drawer of the shift that is open now; digital goes with the day's digital total.</div>
      </div>
    </div>

    <div class="hist-card mb-3">
      <div class="hist-card-head">Credit limit</div>
      <div class="hist-card-body row g-2 align-items-end">
        <div class="col-md-3"><label class="form-label">Most they may owe (&#8377;)</label><input type="number" min="0" class="form-control" [(ngModel)]="limit" data-testid="due-limit-input"></div>
        <div class="col-md-2"><button class="btn btn-outline-primary w-100" type="button" (click)="saveLimit()" data-testid="due-limit-save">Set limit</button></div>
        <div class="col-md-7 small text-muted">A Store Head or Business Head sets it. Cashiers can bill on credit only within it, and not while anything is overdue.</div>
      </div>
    </div>

    <div class="hist-card" *ngIf="d?.entries?.length; else none">
      <table class="table table-sm table-hover mb-0" data-testid="due-table">
        <thead><tr><th>Date</th><th>What</th><th>Store</th><th class="text-end">Amount</th><th>Note</th><th>By</th></tr></thead>
        <tbody>
          <tr *ngFor="let e of d.entries" data-testid="due-entry">
            <td>{{e.entry_date | date:'dd MMM yyyy'}}</td><td>{{label(e)}}</td><td>{{e.store}}</td>
            <td class="text-end" [class.text-success]="e.amount < 0">&#8377;{{e.amount | number:'1.2-2'}}</td><td>{{e.note}}</td><td>{{e.by_name}}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #none><div class="hist-empty"><i class="bi bi-hourglass-split"></i>Nothing owed or paid yet.</div></ng-template>

    <div class="hist-card mt-3" *ngIf="canAdjust">
      <div class="hist-card-head">Correct what they owe</div>
      <div class="hist-card-body row g-2 align-items-end">
        <div class="col-md-3"><label class="form-label">Adjust by (&#8377;, minus to reduce)</label><input type="number" class="form-control" [(ngModel)]="adj.amount" data-testid="due-adj-amount"></div>
        <div class="col-md-7"><label class="form-label">Why</label><input class="form-control" maxlength="200" [(ngModel)]="adj.note" data-testid="due-adj-note"></div>
        <div class="col-md-2"><button class="btn btn-outline-primary w-100" type="button" (click)="adjust()" data-testid="due-adj-save">Adjust</button></div>
      </div>
    </div>`
})
export class CustomerDuesComponent implements OnInit {
  @Input() customerId = 0;
  d: any = null;
  error = "";
  saving = false;
  limit: number | null = null;
  pay: any = { amount: null, mode: "CASH", note: "" };
  adj: any = { amount: null, note: "" };
  canAdjust = false;
  today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

  constructor(private http: HttpClient, auth: AuthService, private storeContext: StoreContextService) {
    this.canAdjust = auth.isActionAuthorized("hr.manage");     // the Business Head holds this
  }

  ngOnInit() { this.load(); }

  private set(d: any) { this.d = d; this.limit = d.limit; }
  private fail(e: any, fallback: string) { const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || fallback); this.saving = false; }

  load() {
    this.http.get<any>(`${environment.apiHost}/customer-dues/${this.customerId}`).subscribe(d => this.set(d), e => this.fail(e, "Could not load what this customer owes."));
  }

  collect() {
    this.error = ""; this.saving = true;
    this.http.post<any>(`${environment.apiHost}/customer-dues/${this.customerId}/payment`,
      { ...this.pay, storeid: this.storeContext.selectedStoreId }).subscribe(
      d => { this.set(d); this.pay.amount = null; this.pay.note = ""; this.saving = false; }, e => this.fail(e, "Could not record the payment."));
  }

  saveLimit() {
    this.error = "";
    this.http.put<any>(`${environment.apiHost}/customer-dues/${this.customerId}/limit`, { limit: this.limit }).subscribe(d => this.set(d), e => this.fail(e, "Could not set the limit."));
  }

  adjust() {
    this.error = "";
    this.http.post<any>(`${environment.apiHost}/customer-dues/${this.customerId}/adjustment`, this.adj).subscribe(
      d => { this.set(d); this.adj = { amount: null, note: "" }; }, e => this.fail(e, "Could not adjust."));
  }

  label(e: any) {
    if (e.kind === "DUE") return "Left to pay" + (e.due_date ? " (by " + e.due_date + ")" : "");
    if (e.kind === "PAYMENT") return "Paid (" + (e.pay_mode === "CASH" ? "cash" : "digital") + ")";
    return "Adjustment";
  }
}

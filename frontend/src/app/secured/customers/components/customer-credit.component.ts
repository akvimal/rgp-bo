import { Component, Input, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { AuthService } from "../../../@core/auth/auth.service";

/** A customer's store credit: balance and history. The Business Head can correct it with a reason. */
@Component({
  selector: "app-customer-credit",
  template: `
    <div class="mb-2">Balance: <strong data-testid="cc-balance">&#8377;{{balance | number:'1.2-2'}}</strong>
      <span class="small text-muted ms-2">Credit from returns; usable on a bill at any store.</span></div>
    <div *ngIf="error" class="alert alert-danger py-2">{{error}}</div>
    <table class="table table-sm" *ngIf="entries.length; else none" data-testid="cc-table">
      <thead><tr><th>Date</th><th>What</th><th>Store</th><th class="text-end">Amount</th><th>Note</th><th>By</th></tr></thead>
      <tbody>
        <tr *ngFor="let e of entries" data-testid="cc-entry">
          <td>{{e.entry_date | date:'dd MMM yyyy'}}</td><td>{{label(e.kind)}}</td><td>{{e.store}}</td>
          <td class="text-end" [class.text-danger]="e.amount < 0">{{e.amount | number:'1.2-2'}}</td><td>{{e.note}}</td><td>{{e.by_name}}</td>
        </tr>
      </tbody>
    </table>
    <ng-template #none><div class="small text-muted">No store credit yet.</div></ng-template>
    <div class="row g-2 align-items-end mt-2" *ngIf="canAdjust">
      <div class="col-md-2"><label class="form-label">Adjust by</label><input type="number" class="form-control" [(ngModel)]="amount" data-testid="cc-amount"></div>
      <div class="col-md-6"><label class="form-label">Why</label><input class="form-control" maxlength="200" [(ngModel)]="note" data-testid="cc-note"></div>
      <div class="col-md-2"><button class="btn btn-outline-primary" type="button" (click)="adjust()" data-testid="cc-save">Adjust</button></div>
    </div>`
})
export class CustomerCreditComponent implements OnInit {
  @Input() customerId = 0;
  balance = 0;
  entries: any[] = [];
  error = "";
  amount: number | null = null;
  note = "";
  canAdjust = false;

  constructor(private http: HttpClient, auth: AuthService) {
    this.canAdjust = auth.isActionAuthorized("hr.manage");     // the Business Head holds this
  }

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>(`${environment.apiHost}/customers/${this.customerId}/credit`).subscribe(d => { this.balance = d.balance; this.entries = d.entries; }, () => this.error = "Could not load store credit.");
  }

  adjust() {
    this.error = "";
    this.http.post<any>(`${environment.apiHost}/customers/${this.customerId}/credit/adjustment`, { amount: this.amount, note: this.note }).subscribe(
      d => { this.balance = d.balance; this.entries = d.entries; this.amount = null; this.note = ""; },
      e => { const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || "Could not adjust."); });
  }

  label(k: string) { return k === "ISSUED" ? "Issued (return)" : k === "REDEEMED" ? "Used on a bill" : "Adjustment"; }
}

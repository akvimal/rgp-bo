import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

/** Everyone who owes for bills left to pay later, the overdue first, to follow up. */
@Component({
  selector: "app-customer-dues-list",
  template: `
    <div class="d-flex align-items-center gap-2 mb-2">
      <a routerLink="../list" class="small">&larr; Customers</a>
      <h5 class="mb-0 ms-2">Customers who owe</h5>
      <span class="ms-auto text-muted small" data-testid="dues-total">Total owed &#8377;{{total | number:'1.0-0'}}<span *ngIf="late > 0" class="text-danger"> &middot; overdue &#8377;{{late | number:'1.0-0'}}</span></span>
    </div>
    <div *ngIf="error" class="alert alert-danger py-2">{{error}}</div>
    <div class="hist-card" *ngIf="rows.length; else none">
      <table class="table table-sm table-hover mb-0" data-testid="dues-table">
        <thead><tr><th>Customer</th><th>Mobile</th><th>Location</th><th class="text-end">Owes</th><th class="text-end">Limit</th><th class="text-end">Overdue</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows" data-testid="dues-row">
            <td>{{r.name}}</td><td>{{r.mobile || 'no mobile'}}</td><td>{{r.locality}}</td>
            <td class="text-end">&#8377;{{r.balance | number:'1.2-2'}}</td><td class="text-end">&#8377;{{r.credit_limit | number:'1.0-0'}}</td>
            <td class="text-end" [class.text-danger]="r.overdue > 0"><ng-container *ngIf="r.overdue > 0">&#8377;{{r.overdue | number:'1.2-2'}} since {{r.since | date:'dd MMM'}}</ng-container></td>
            <td class="text-end"><a [routerLink]="['../view', r.id]" class="btn btn-sm btn-outline-primary">Open</a></td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #none><div class="hist-empty"><i class="bi bi-check-circle"></i>Nobody owes anything.</div></ng-template>`
})
export class CustomerDuesListComponent implements OnInit {
  rows: any[] = [];
  error = "";
  get total() { return this.rows.reduce((s, r) => s + r.balance, 0); }
  get late() { return this.rows.reduce((s, r) => s + r.overdue, 0); }
  constructor(private http: HttpClient) {}
  ngOnInit() {
    this.http.get<any[]>(`${environment.apiHost}/customer-dues/owing/all`).subscribe(r => this.rows = r || [], () => this.error = "Could not load the list.");
  }
}

import { Component, OnInit } from "@angular/core";
import { ExpenseApi } from "./expense.service";

/** Rent, salaries, utilities: the usual monthly amounts. "Create entries" adds the month's expenses once, for approval. */
@Component({
  selector: "app-expense-recurring",
  template: `
    <div class="card"><div class="card-body pt-3">
      <div class="small text-muted mb-2">Set up what is paid every month. Creating a month adds one expense for each active line, once, waiting for approval so you can correct the amount (electricity varies).</div>
      <div class="page-toolbar">
        <div class="page-toolbar-main">
          <div><label class="form-label">Month</label><input type="month" class="form-control" style="width:11rem" [(ngModel)]="period" data-testid="rec-period"></div>
          <button class="btn btn-outline-primary mb-0" type="button" (click)="generate()" data-testid="rec-generate">Create entries for the month</button>
        </div>
        <div class="page-toolbar-actions"><button class="btn btn-primary" type="button" (click)="add()" data-testid="rec-add">Add recurring expense</button></div>
      </div>
      <div *ngIf="message" class="alert alert-success py-2" data-testid="exp-message">{{message}}</div>
      <div *ngIf="error" class="alert alert-danger py-2" data-testid="exp-error">{{error}}</div>

      <div *ngIf="form" class="border rounded p-3 mb-3" data-testid="rec-form">
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label">Category *</label>
            <select class="form-select" [(ngModel)]="form.category_id" data-testid="rec-category"><option [ngValue]="null">Choose</option><option *ngFor="let c of categories" [ngValue]="c.id">{{c.name}}</option></select></div>
          <div class="col-md-3"><label class="form-label">Store</label>
            <select class="form-select" [(ngModel)]="form.store_id"><option [ngValue]="null">Business level</option><option *ngFor="let s of stores" [ngValue]="s.id">{{s.name}}</option></select></div>
          <div class="col-md-2"><label class="form-label">Usual amount *</label><input type="number" min="0" class="form-control" [(ngModel)]="form.amount" data-testid="rec-amount"></div>
          <div class="col-md-2"><label class="form-label">Day of month</label><input type="number" min="1" max="28" class="form-control" [(ngModel)]="form.day_of_month"></div>
          <div class="col-md-2"><label class="form-label">Paid by</label>
            <select class="form-select" [(ngModel)]="form.pay_mode"><option value="CASH">Cash</option><option value="BANK">Bank transfer</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option></select></div>
          <div class="col-md-3"><label class="form-label">Paid to</label><input class="form-control" maxlength="100" [(ngModel)]="form.payee" data-testid="rec-payee"></div>
          <div class="col-md-3"><label class="form-label">What for</label><input class="form-control" maxlength="300" [(ngModel)]="form.description"></div>
          <div class="col-md-2"><label class="form-label">From month *</label><input type="month" class="form-control" [(ngModel)]="form.start_month" data-testid="rec-start"></div>
          <div class="col-md-2"><label class="form-label">Until month</label><input type="month" class="form-control" [(ngModel)]="form.end_month"></div>
          <div class="col-md-2 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" id="recActive" [(ngModel)]="form.active"><label class="form-check-label" for="recActive">Active</label></div></div>
          <div class="col-md-12"><button class="btn btn-primary" type="button" (click)="save()" data-testid="rec-save">Save</button><button class="btn btn-outline-secondary ms-2" type="button" (click)="form = null">Cancel</button></div>
        </div>
      </div>

      <table class="table table-sm align-middle" data-testid="rec-table">
        <thead><tr><th>Category</th><th>Store</th><th>Paid to</th><th class="text-end">Amount</th><th>Day</th><th>From</th><th>Until</th><th>Active</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows" data-testid="rec-row"><td>{{r.category}}</td><td>{{r.store || 'Business'}}</td><td>{{r.payee}}</td><td class="text-end">{{r.amount | number:'1.2-2'}}</td><td>{{r.day_of_month}}</td><td>{{r.start_month}}</td><td>{{r.end_month}}</td><td>{{r.active ? 'Yes' : 'No'}}</td>
            <td class="text-end"><button class="btn btn-outline-secondary btn-sm" type="button" (click)="edit(r)">Edit</button></td></tr>
          <tr *ngIf="!rows.length"><td colspan="9" class="text-center text-muted py-3">Nothing set up yet.</td></tr>
        </tbody>
      </table>
    </div></div>`
})
export class ExpenseRecurringComponent implements OnInit {
  rows: any[] = [];
  categories: any[] = [];
  stores: any[] = [];
  period = "";
  form: any = null;
  message = "";
  error = "";

  constructor(private api: ExpenseApi) {}

  ngOnInit() {
    this.period = this.api.thisMonth();
    this.api.get("categories").subscribe(c => this.categories = c.filter((x: any) => x.active));
    this.api.get("policy").subscribe(p => this.stores = p.stores);
    this.load();
  }

  load() { this.api.get("recurring").subscribe(r => this.rows = r, e => this.error = this.api.msg(e)); }

  add() { this.message = this.error = ""; this.form = { id: 0, category_id: null, store_id: null, amount: null, day_of_month: 1, pay_mode: "BANK", payee: "", description: "", start_month: this.api.thisMonth(), end_month: "", active: true }; }
  edit(r: any) { this.message = this.error = ""; this.form = { ...r, end_month: r.end_month || "" }; }

  save() {
    this.message = this.error = "";
    const b = { ...this.form, end_month: this.form.end_month || null };
    (b.id ? this.api.put(`recurring/${b.id}`, b) : this.api.post("recurring", b)).subscribe(() => { this.message = "Saved."; this.form = null; this.load(); }, (e: any) => this.error = this.api.msg(e));
  }

  generate() {
    this.message = this.error = "";
    this.api.post("recurring/generate", { period: this.period }).subscribe((r: any) => this.message = r.created ? `${r.created} expense(s) created for ${this.period}; approve them under Expenses.` : `Nothing new to create for ${this.period}.`, (e: any) => this.error = this.api.msg(e));
  }
}

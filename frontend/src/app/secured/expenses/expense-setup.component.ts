import { Component, OnInit } from "@angular/core";
import { ExpenseApi } from "./expense.service";

/** The Store Head's approval limit and the category list. */
@Component({
  selector: "app-expense-setup",
  template: `
    <div class="card"><div class="card-body pt-3">
      <div *ngIf="message" class="alert alert-success py-2" data-testid="exp-message">{{message}}</div>
      <div *ngIf="error" class="alert alert-danger py-2" data-testid="exp-error">{{error}}</div>
      <h6>Approval limit</h6>
      <div class="small text-muted mb-2">A Store Head approves store expenses up to this amount (and their own are approved on the spot). Above it, and every business-level expense, the Business Head approves.</div>
      <div class="input-group mb-4" style="max-width:22rem">
        <span class="input-group-text">&#8377;</span><input type="number" min="0" class="form-control" [(ngModel)]="limit" data-testid="set-limit">
        <button class="btn btn-primary" type="button" (click)="saveLimit()" data-testid="set-limit-save">Save</button>
      </div>
      <h6>Categories</h6>
      <table class="table table-sm align-middle" style="max-width:40rem" data-testid="set-cats">
        <thead><tr><th>Name</th><th class="text-center">Active</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let c of categories"><td><input class="form-control form-control-sm" maxlength="60" [(ngModel)]="c.name"></td><td class="text-center"><input type="checkbox" class="form-check-input" [(ngModel)]="c.active"></td>
            <td class="text-end"><button class="btn btn-outline-primary btn-sm" type="button" (click)="saveCategory(c)">Save</button></td></tr>
          <tr><td><input class="form-control form-control-sm" placeholder="New category" maxlength="60" [(ngModel)]="newName" data-testid="set-cat-name"></td><td></td>
            <td class="text-end"><button class="btn btn-primary btn-sm" type="button" (click)="addCategory()" data-testid="set-cat-add">Add</button></td></tr>
        </tbody>
      </table>
    </div></div>`
})
export class ExpenseSetupComponent implements OnInit {
  limit = 0;
  categories: any[] = [];
  newName = "";
  message = "";
  error = "";

  constructor(private api: ExpenseApi) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.get("policy").subscribe(p => this.limit = p.limit);
    this.api.get("categories").subscribe(c => this.categories = c);
  }

  private done(text: string) { return () => { this.message = text; this.error = ""; this.load(); }; }
  private fail() { return (e: any) => { this.error = this.api.msg(e); this.message = ""; }; }

  saveLimit() { this.api.put("limit", { limit: this.limit }).subscribe(this.done("Limit saved."), this.fail()); }
  saveCategory(c: any) { this.api.put(`categories/${c.id}`, c).subscribe(this.done("Category saved."), this.fail()); }
  addCategory() { this.api.post("categories", { name: this.newName }).subscribe(() => { this.newName = ""; this.done("Category added.")(); }, this.fail()); }
}

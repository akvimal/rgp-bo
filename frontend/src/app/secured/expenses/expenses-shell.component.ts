import { Component } from "@angular/core";

@Component({
  selector: "app-expenses-shell",
  template: `
    <div class="pagetitle"><h1>Expenses</h1></div>
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item"><a class="nav-link" routerLink="list" routerLinkActive="active" data-testid="exp-tab-list">Expenses</a></li>
      <li class="nav-item" *isAuth="'expenses.manage'"><a class="nav-link" routerLink="recurring" routerLinkActive="active" data-testid="exp-tab-recurring">Recurring</a></li>
      <li class="nav-item" *isAuth="'expenses.approve'"><a class="nav-link" routerLink="report" routerLinkActive="active" data-testid="exp-tab-report">Report</a></li>
      <li class="nav-item" *isAuth="'expenses.manage'"><a class="nav-link" routerLink="setup" routerLinkActive="active" data-testid="exp-tab-setup">Setup</a></li>
    </ul>
    <router-outlet></router-outlet>
  `
})
export class ExpensesShellComponent {}

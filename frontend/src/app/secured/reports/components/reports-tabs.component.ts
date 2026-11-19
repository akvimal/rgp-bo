import { Component } from "@angular/core";

/** The strip at the top of the Reports pages: the hub of all reports, asking the shop a question, and the weekly summary. */
@Component({
  selector: "app2-reports-tabs",
  template: `
    <ul class="nav nav-tabs" data-testid="rp-tabs">
      <li class="nav-item"><a class="nav-link" routerLink="/secure/reports" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" data-testid="rp-tab-all">All reports</a></li>
      <li class="nav-item" *isAuth="'reports.ask'"><a class="nav-link" routerLink="/secure/reports/ask" routerLinkActive="active" data-testid="rp-tab-ask">Ask the shop</a></li>
      <li class="nav-item" *isAuth="'reports.margin'"><a class="nav-link" routerLink="/secure/reports/weekly" routerLinkActive="active" data-testid="rp-tab-weekly">Weekly summary</a></li>
    </ul>`,
})
export class ReportsTabsComponent {}

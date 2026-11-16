import { Component } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";
import { HR_TABS } from "./hr-access.guard";

/** The strip at the top of the HR pages: only the tabs the role holds the action for. */
@Component({
  selector: "app-hr-shell",
  template: `
    <div class="page-head"><h1>HR</h1>
    <ul class="nav nav-tabs">
      <li class="nav-item" *ngFor="let t of tabs()"><a class="nav-link" [routerLink]="t.path" routerLinkActive="active" [attr.data-testid]="t.testid">{{t.label}}</a></li>
    </ul>
    </div>
    <router-outlet></router-outlet>
  `
})
export class HrShellComponent {
  constructor(private auth: AuthService) {}
  tabs() { return HR_TABS.filter((t) => t.needs.some((k) => this.auth.isActionAuthorized(k))); }
}

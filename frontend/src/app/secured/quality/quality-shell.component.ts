import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../../@core/auth/auth.service";
import { MenuModeService } from "../menu-mode.service";

/** what each page is called when the grouped menu has already put it under its own job (Sell, Accounts, People, Oversight) */
const PAGE_TITLES: { path: string; title: string }[] = [
  { path: '/grievances', title: 'Complaints' },
  { path: '/refills', title: 'Refill follow-up' },
  { path: '/staff-sales', title: 'Staff performance' },
  { path: '/staff-credit', title: 'Staff credit' },
  { path: '/discrepancies', title: 'Cash & shifts' },
  { path: '/audit', title: 'Audit log' },
];

@Component({
  selector: "app-quality-shell",
  template: `
    <div class="page-head"><h1>{{title}}</h1>
    <ul class="nav nav-tabs" *ngIf="!menuMode.grouped">
      <li class="nav-item" *isAuth="'grievances.view'">
        <a class="nav-link" routerLink="grievances" routerLinkActive="active" data-testid="tab-grievances">Grievances</a>
      </li>
      <li class="nav-item" *isAuth="'refills.view'">
        <a class="nav-link" routerLink="refills" routerLinkActive="active" data-testid="tab-refills">Refills</a>
      </li>
      <li class="nav-item" *isAuth="'staffsales.view'">
        <a class="nav-link" routerLink="staff-sales" routerLinkActive="active" data-testid="tab-staff-sales">Staff sales</a>
      </li>
      <li class="nav-item" *isAuth="'staffcredit.view'">
        <a class="nav-link" routerLink="staff-credit" routerLinkActive="active" data-testid="tab-staff-credit">Staff credit</a>
      </li>
      <li class="nav-item" *isAuth="'discrepancies.view'">
        <a class="nav-link" routerLink="discrepancies" routerLinkActive="active" data-testid="tab-discrepancies">Cash &amp; shifts</a>
      </li>
      <li class="nav-item" *isAuth="'audit.view'">
        <a class="nav-link" routerLink="audit" routerLinkActive="active" data-testid="tab-audit">Audit log</a>
      </li>
    </ul>
    </div>
    <router-outlet></router-outlet>
  `
})
export class QualityShellComponent {
  constructor(private auth: AuthService, private router: Router, public menuMode: MenuModeService) {}

  /**
   * The old menu: "Staff & Quality" (the counter only has the refill list, so it is named for what it is). The grouped menu: the page's own name,
   * because Refills is a Sell page and Cash & shifts an Accounts page, not parts of one drawer.
   */
  get title(): string {
    if (this.menuMode.grouped) {
      const url = this.router.url.split(/[?#]/)[0];
      const page = PAGE_TITLES.find((p) => url.endsWith(p.path) || url.includes(p.path + '/'));
      if (page) return page.title;
    }
    return this.auth.isActionAuthorized('grievances.view') ? 'Staff & Quality' : 'Refill follow-up';
  }
}

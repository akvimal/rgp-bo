import { Component } from "@angular/core";

@Component({
  selector: "app-quality-shell",
  template: `
    <div class="pagetitle"><h1>Staff &amp; Quality</h1></div>
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item" *isAuth="'grievances.view'">
        <a class="nav-link" routerLink="grievances" routerLinkActive="active" data-testid="tab-grievances">Grievances</a>
      </li>
      <li class="nav-item" *isAuth="'staffsales.view'">
        <a class="nav-link" routerLink="staff-sales" routerLinkActive="active" data-testid="tab-staff-sales">Staff sales</a>
      </li>
      <li class="nav-item" *isAuth="'discrepancies.view'">
        <a class="nav-link" routerLink="discrepancies" routerLinkActive="active" data-testid="tab-discrepancies">Cash &amp; shifts</a>
      </li>
      <li class="nav-item" *isAuth="'audit.view'">
        <a class="nav-link" routerLink="audit" routerLinkActive="active" data-testid="tab-audit">Audit log</a>
      </li>
    </ul>
    <router-outlet></router-outlet>
  `
})
export class QualityShellComponent {}

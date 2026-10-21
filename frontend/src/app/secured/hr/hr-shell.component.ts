import { Component } from "@angular/core";

@Component({
  selector: "app-hr-shell",
  template: `
    <div class="pagetitle"><h1>HR</h1></div>
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item"><a class="nav-link" routerLink="staff" routerLinkActive="active" data-testid="hr-tab-staff">Staff</a></li>
      <li class="nav-item"><a class="nav-link" routerLink="attendance" routerLinkActive="active" data-testid="hr-tab-attendance">Attendance</a></li>
      <li class="nav-item"><a class="nav-link" routerLink="leave" routerLinkActive="active" data-testid="hr-tab-leave">Leave</a></li>
      <li class="nav-item"><a class="nav-link" routerLink="kpi" routerLinkActive="active" data-testid="hr-tab-kpi">KPI</a></li>
      <li class="nav-item"><a class="nav-link" routerLink="payroll" routerLinkActive="active" data-testid="hr-tab-payroll">Payroll</a></li>
      <li class="nav-item"><a class="nav-link" routerLink="setup" routerLinkActive="active" data-testid="hr-tab-setup">Setup</a></li>
    </ul>
    <router-outlet></router-outlet>
  `
})
export class HrShellComponent {}

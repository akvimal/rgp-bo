import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "src/app/@core/auth/auth.service";

/** The HR tabs and the action each needs (any one of them opens it); MENU_AND_PERMISSIONS step D, HR. `hr.view` opens the pages, the tab needs its own action. */
export const HR_TABS: Array<{ path: string; label: string; testid: string; needs: string[] }> = [
  { path: "staff", label: "Staff", testid: "hr-tab-staff", needs: ["hr.staff.view"] },
  { path: "attendance", label: "Attendance", testid: "hr-tab-attendance", needs: ["hr.attendance.manage"] },
  { path: "leave", label: "Leave", testid: "hr-tab-leave", needs: ["hr.leave.manage"] },
  { path: "kpi", label: "KPI", testid: "hr-tab-kpi", needs: ["hr.kpi.setup"] },
  { path: "bonus", label: "Bonus", testid: "hr-tab-bonus", needs: ["hr.bonus.manage"] },
  { path: "payroll", label: "Payroll", testid: "hr-tab-payroll", needs: ["hr.payroll.view"] },
  { path: "coaching", label: "Coaching", testid: "hr-tab-coaching", needs: ["hr.staff.view"] },
  { path: "assistant", label: "Role assistant", testid: "hr-tab-assistant", needs: ["hr.kpi.setup"] },
  { path: "setup", label: "Setup", testid: "hr-tab-setup", needs: ["hr.staff.manage", "hr.pay.manage", "hr.leave.manage"] },
];

/** A person who opens an HR tab without its action is sent to the first tab they may open, or to the dashboard when they have none. */
@Injectable({ providedIn: "root" })
export class HrAccessGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const need = (route.data["needs"] as string[]) || [];
    if (need.some((k) => this.auth.isActionAuthorized(k))) return true;
    const next = HR_TABS.find((t) => t.needs.some((k) => this.auth.isActionAuthorized(k)));
    return this.router.parseUrl(next ? `/secure/hr/${next.path}` : "/secure/dashboard");
  }
}

import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "src/app/@core/auth/auth.service";

/**
 * The Reports tabs each need their own action (MENU_AND_PERMISSIONS step D): sales report, Ask the shop, weekly summary. A person who opens
 * Reports without the tab's action is sent to the first tab they may open, or to the dashboard when they have none.
 */
@Injectable({ providedIn: "root" })
export class ReportsAccessGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const need = route.data["needs"] as string;
    if (this.auth.isActionAuthorized(need)) return true;
    const order: Array<[string, string]> = [["reports.sales", "/secure/reports/sales"], ["reports.ask", "/secure/reports/ask"], ["reports.margin", "/secure/reports/weekly"]];
    const next = order.find((o) => this.auth.isActionAuthorized(o[0]));
    return this.router.parseUrl(next ? next[1] : "/secure/dashboard");
  }
}

import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "src/app/@core/auth/auth.service";

/**
 * The Reports tabs each need their own action (MENU_AND_PERMISSIONS step D): Ask the shop and the weekly summary. The hub (needs 'hub') is open to everyone signed in; its cards follow the role. A person who opens
 * Reports without the tab's action is sent to the first tab they may open, or to the dashboard when they have none.
 */
@Injectable({ providedIn: "root" })
export class ReportsAccessGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const need = route.data["needs"] as string;
    if (need === "hub") return true;
    if (this.auth.isActionAuthorized(need)) return true;
    const order: Array<[string, string]> = [["reports.ask", "/secure/reports/ask"], ["reports.margin", "/secure/reports/weekly"]];
    const next = order.find((o) => this.auth.isActionAuthorized(o[0]));
    return this.router.parseUrl(next ? next[1] : "/secure/dashboard");
  }
}

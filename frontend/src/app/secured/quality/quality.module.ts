import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { AuditLogComponent } from "./audit-log.component";
import { DiscrepanciesComponent } from "./discrepancies.component";
import { GrievancesComponent } from "./grievances.component";
import { QualityShellComponent } from "./quality-shell.component";
import { RefillsComponent } from "./refills.component";
import { StaffSalesComponent } from "./staff-sales.component";
import { StaffCreditComponent } from "./staff-credit.component";

const routes: Routes = [
  { path: "", component: QualityShellComponent, children: [
    { path: "", redirectTo: "grievances", pathMatch: "full" },
    { path: "grievances", component: GrievancesComponent, canActivate: [AuthGuard] },
    { path: "refills", component: RefillsComponent, canActivate: [AuthGuard] },
    { path: "discrepancies", component: DiscrepanciesComponent, canActivate: [AuthGuard] },
    { path: "staff-sales", component: StaffSalesComponent, canActivate: [AuthGuard] },
    { path: "staff-credit", component: StaffCreditComponent, canActivate: [AuthGuard] },
    { path: "audit", component: AuditLogComponent, canActivate: [AuthGuard] },
  ]},
];

/** Staff & Quality: oversight of people and service quality. More pages (grievances, reviews) land here. */
@NgModule({
  declarations: [QualityShellComponent, GrievancesComponent, RefillsComponent, StaffSalesComponent, DiscrepanciesComponent, AuditLogComponent, StaffCreditComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class QualityModule {}

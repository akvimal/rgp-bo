import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { HrShellComponent } from "./hr-shell.component";
import { HrStaffComponent } from "./hr-staff.component";
import { HrAttendanceComponent } from "./hr-attendance.component";
import { HrLeaveComponent } from "./hr-leave.component";
import { HrKpiComponent } from "./hr-kpi.component";
import { HrPayrollComponent } from "./hr-payroll.component";
import { HrSetupComponent } from "./hr-setup.component";
import { HrRolesComponent } from "./hr-roles.component";

const routes: Routes = [
  { path: "", component: HrShellComponent, children: [
    { path: "", redirectTo: "staff", pathMatch: "full" },
    { path: "staff", component: HrStaffComponent, canActivate: [AuthGuard] },
    { path: "attendance", component: HrAttendanceComponent, canActivate: [AuthGuard] },
    { path: "leave", component: HrLeaveComponent, canActivate: [AuthGuard] },
    { path: "kpi", component: HrKpiComponent, canActivate: [AuthGuard] },
    { path: "payroll", component: HrPayrollComponent, canActivate: [AuthGuard] },
    { path: "setup", component: HrSetupComponent, canActivate: [AuthGuard] },
  ]},
];

/** Mini HR for the Business Head: staff, salary, leave, attendance, KPI and payroll. */
@NgModule({
  declarations: [HrShellComponent, HrStaffComponent, HrAttendanceComponent, HrLeaveComponent, HrKpiComponent, HrPayrollComponent, HrSetupComponent, HrRolesComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class HrModule {}

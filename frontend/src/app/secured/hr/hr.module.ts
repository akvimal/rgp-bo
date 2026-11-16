import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { HrShellComponent } from "./hr-shell.component";
import { HrAccessGuard } from "./hr-access.guard";
import { HrStaffComponent } from "./hr-staff.component";
import { HrAttendanceComponent } from "./hr-attendance.component";
import { HrLeaveComponent } from "./hr-leave.component";
import { HrKpiComponent } from "./hr-kpi.component";
import { HrPayrollComponent } from "./hr-payroll.component";
import { HrBonusComponent } from "./hr-bonus.component";
import { HrSetupComponent, HrSetupLeaveGuard } from "./hr-setup.component";
import { HrSidePanelComponent } from "./hr-side-panel.component";
import { HrPeopleComponent } from "./hr-people.component";
import { HrRolesComponent } from "./hr-roles.component";
import { HrStartComponent } from "./hr-start.component";
import { HrAssistantComponent } from "./hr-assistant.component";
import { HrCoachingComponent } from "./hr-coaching.component";

const routes: Routes = [
  { path: "", component: HrShellComponent, children: [
    { path: "", redirectTo: "staff", pathMatch: "full" },
    { path: "staff", component: HrStaffComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.staff.view"] } },
    { path: "attendance", component: HrAttendanceComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.attendance.manage"] } },
    { path: "leave", component: HrLeaveComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.leave.manage"] } },
    { path: "kpi", component: HrKpiComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.kpi.setup"] } },
    { path: "bonus", component: HrBonusComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.bonus.manage"] } },
    { path: "payroll", component: HrPayrollComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.payroll.view"] } },
    { path: "assistant", component: HrAssistantComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.kpi.setup"] } },
    { path: "coaching", component: HrCoachingComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.staff.view"] } },
    { path: "setup", component: HrSetupComponent, canActivate: [AuthGuard, HrAccessGuard], data: { needs: ["hr.staff.manage", "hr.pay.manage", "hr.leave.manage"] }, canDeactivate: [HrSetupLeaveGuard] },
  ]},
];

/** Mini HR for the Business Head: staff, salary, leave, attendance, KPI and payroll. */
@NgModule({
  providers: [HrSetupLeaveGuard],
  declarations: [HrShellComponent, HrStaffComponent, HrAttendanceComponent, HrLeaveComponent, HrKpiComponent, HrPayrollComponent, HrBonusComponent, HrSetupComponent, HrSidePanelComponent, HrPeopleComponent, HrRolesComponent, HrStartComponent, HrAssistantComponent, HrCoachingComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class HrModule {}

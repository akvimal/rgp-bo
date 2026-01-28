import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Admin/Employee Shared Components
import { HrDashboardComponent } from './components/hr-dashboard.component';
import { AttendanceClockComponent } from './components/attendance-clock.component';
import { LeaveRequestComponent } from './components/leave-request.component';

// Admin Components
import { ShiftManagementComponent } from './components/shift-management.component';
import { ShiftAssignmentsComponent } from './components/shift-assignments.component';
import { PolicyManagementComponent } from './components/policy-management.component';
import { BenefitManagementComponent } from './components/benefit-management.component';
import { ClaimsManagementComponent } from './components/claims-management.component';
import { EnrollmentManagementComponent } from './components/enrollment-management.component';

// Employee Components (Phase 6)
import { EmployeePoliciesComponent } from './components/employee-policies.component';
import { MyBenefitsComponent } from './components/my-benefits.component';
import { EmployeeBenefitEnrollmentComponent } from './components/employee-benefit-enrollment.component';
import { EmployeeClaimSubmissionComponent } from './components/employee-claim-submission.component';
import { MyClaimsComponent } from './components/my-claims.component';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Shared Routes (Employee & Admin)
  { path: 'dashboard', component: HrDashboardComponent },
  { path: 'attendance', component: AttendanceClockComponent },
  { path: 'leave', component: LeaveRequestComponent },

  // Admin Routes
  { path: 'shifts', component: ShiftManagementComponent },
  { path: 'shift-assignments', component: ShiftAssignmentsComponent },
  { path: 'policies', component: PolicyManagementComponent },
  { path: 'benefits', component: BenefitManagementComponent },
  { path: 'enrollments', component: EnrollmentManagementComponent },
  { path: 'claims', component: ClaimsManagementComponent },

  // Employee Routes (Phase 6)
  { path: 'my-policies', component: EmployeePoliciesComponent },
  { path: 'my-benefits', component: MyBenefitsComponent },
  { path: 'enroll-benefits', component: EmployeeBenefitEnrollmentComponent },
  { path: 'submit-claim', component: EmployeeClaimSubmissionComponent },
  { path: 'my-claims', component: MyClaimsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HrRoutingModule {}

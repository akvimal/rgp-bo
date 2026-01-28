import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HrRoutingModule } from './hr-routing.module';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { BadgeModule } from 'primeng/badge';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { TabViewModule } from 'primeng/tabview';
import { TimelineModule } from 'primeng/timeline';
import { InputNumberModule } from 'primeng/inputnumber';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

// Admin Components
import { HrDashboardComponent } from './components/hr-dashboard.component';
import { AttendanceClockComponent } from './components/attendance-clock.component';
import { LeaveRequestComponent } from './components/leave-request.component';
import { ShiftManagementComponent } from './components/shift-management.component';
import { ShiftFormComponent } from './components/shift-form.component';
import { UserShiftAssignmentComponent } from './components/user-shift-assignment.component';
import { ShiftAssignmentsComponent } from './components/shift-assignments.component';
import { PolicyManagementComponent } from './components/policy-management.component';
import { PolicyFormComponent } from './components/policy-form.component';
import { BenefitManagementComponent } from './components/benefit-management.component';
import { BenefitPolicyFormComponent } from './components/benefit-policy-form.component';
import { ClaimsManagementComponent } from './components/claims-management.component';
import { ClaimReviewDialogComponent } from './components/claim-review-dialog.component';
import { EnrollmentManagementComponent } from './components/enrollment-management.component';

// Employee Components (Phase 6)
import { EmployeePoliciesComponent } from './components/employee-policies.component';
import { MyBenefitsComponent } from './components/my-benefits.component';
import { EmployeeBenefitEnrollmentComponent } from './components/employee-benefit-enrollment.component';
import { EmployeeClaimSubmissionComponent } from './components/employee-claim-submission.component';
import { MyClaimsComponent } from './components/my-claims.component';
import { ClaimDetailsDialogComponent } from './components/claim-details-dialog.component';

// Services
import { ShiftService } from './services/shift.service';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { ScoringService } from './services/scoring.service';
import { ReportingService } from './services/reporting.service';
import { PoliciesService } from './services/policies.service';
import { BenefitsService } from './services/benefits.service';
import { EnrollmentsService } from './services/enrollments.service';
import { ClaimsService } from './services/claims.service';

@NgModule({
  declarations: [
    // Admin Components
    HrDashboardComponent,
    AttendanceClockComponent,
    LeaveRequestComponent,
    ShiftManagementComponent,
    ShiftFormComponent,
    UserShiftAssignmentComponent,
    ShiftAssignmentsComponent,
    PolicyManagementComponent,
    PolicyFormComponent,
    BenefitManagementComponent,
    BenefitPolicyFormComponent,
    ClaimsManagementComponent,
    ClaimReviewDialogComponent,
    EnrollmentManagementComponent,
    // Employee Components (Phase 6)
    EmployeePoliciesComponent,
    MyBenefitsComponent,
    EmployeeBenefitEnrollmentComponent,
    EmployeeClaimSubmissionComponent,
    MyClaimsComponent,
    ClaimDetailsDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HrRoutingModule,
    // PrimeNG
    ButtonModule,
    CardModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    CalendarModule,
    CheckboxModule,
    TableModule,
    ProgressBarModule,
    BadgeModule,
    ToastModule,
    DialogModule,
    TooltipModule,
    TabViewModule,
    TimelineModule,
    InputNumberModule,
    DividerModule
  ],
  providers: [
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    PoliciesService,
    BenefitsService,
    EnrollmentsService,
    ClaimsService,
    MessageService
  ]
})
export class HrModule {}

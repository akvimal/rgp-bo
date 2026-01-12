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
import { MessageService } from 'primeng/api';

// Components
import { HrDashboardComponent } from './components/hr-dashboard.component';
import { AttendanceClockComponent } from './components/attendance-clock.component';
import { LeaveRequestComponent } from './components/leave-request.component';
import { ShiftManagementComponent } from './components/shift-management.component';
import { ShiftFormComponent } from './components/shift-form.component';
import { UserShiftAssignmentComponent } from './components/user-shift-assignment.component';
import { ShiftAssignmentsComponent } from './components/shift-assignments.component';

// Services
import { ShiftService } from './services/shift.service';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { ScoringService } from './services/scoring.service';
import { ReportingService } from './services/reporting.service';

@NgModule({
  declarations: [
    HrDashboardComponent,
    AttendanceClockComponent,
    LeaveRequestComponent,
    ShiftManagementComponent,
    ShiftFormComponent,
    UserShiftAssignmentComponent,
    ShiftAssignmentsComponent
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
    TooltipModule
  ],
  providers: [
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    MessageService
  ]
})
export class HrModule {}

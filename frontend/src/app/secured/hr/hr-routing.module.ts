import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HrDashboardComponent } from './components/hr-dashboard.component';
import { AttendanceClockComponent } from './components/attendance-clock.component';
import { LeaveRequestComponent } from './components/leave-request.component';
import { ShiftManagementComponent } from './components/shift-management.component';
import { ShiftAssignmentsComponent } from './components/shift-assignments.component';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: HrDashboardComponent },
  { path: 'attendance', component: AttendanceClockComponent },
  { path: 'leave', component: LeaveRequestComponent },
  { path: 'shifts', component: ShiftManagementComponent },
  { path: 'shift-assignments', component: ShiftAssignmentsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HrRoutingModule {}

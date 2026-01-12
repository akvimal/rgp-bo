import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthGuard } from 'src/app/@core/auth/auth.guard';

// Components
import { GstDashboardComponent } from './gst-dashboard.component';
import { Gstr1ReportComponent } from './gstr1-report.component';
import { Gstr3bReportComponent } from './gstr3b-report.component';
import { ItcReconciliationComponent } from './itc-reconciliation.component';

// Service
import { GstReportService } from './gst-report.service';

const routes: Routes = [
  {
    path: 'dashboard',
    component: GstDashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'gstr1',
    component: Gstr1ReportComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'gstr3b',
    component: Gstr3bReportComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'itc-reconciliation',
    component: ItcReconciliationComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];

@NgModule({
  declarations: [
    GstDashboardComponent,
    Gstr1ReportComponent,
    Gstr3bReportComponent,
    ItcReconciliationComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    GstReportService
  ]
})
export class GstReportsModule { }

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PayrollListComponent } from './components/payroll-list/payroll-list.component';
import { PayrollDetailsComponent } from './components/payroll-details/payroll-details.component';
import { PayrollCreateComponent } from './components/payroll-create/payroll-create.component';
import { EmployeePayslipComponent } from './components/employee-payslip/employee-payslip.component';
import { SalaryStructureComponent } from './components/salary-structure/salary-structure.component';

const routes: Routes = [
  {
    path: '',
    component: PayrollListComponent
  },
  {
    path: 'create',
    component: PayrollCreateComponent
  },
  {
    path: ':id/details',
    component: PayrollDetailsComponent
  },
  {
    path: ':payrollRunId/employee/:userId/payslip',
    component: EmployeePayslipComponent
  },
  {
    path: 'salary-structures',
    component: SalaryStructureComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PayrollRoutingModule { }

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PayrollRoutingModule } from './payroll-routing.module';

// Components
import { PayrollListComponent } from './components/payroll-list/payroll-list.component';
import { PayrollDetailsComponent } from './components/payroll-details/payroll-details.component';
import { PayrollCreateComponent } from './components/payroll-create/payroll-create.component';
import { EmployeePayslipComponent } from './components/employee-payslip/employee-payslip.component';
import { SalaryStructureComponent } from './components/salary-structure/salary-structure.component';

// Services
import { PayrollService } from './services/payroll.service';

@NgModule({
  declarations: [
    PayrollListComponent,
    PayrollDetailsComponent,
    PayrollCreateComponent,
    EmployeePayslipComponent,
    SalaryStructureComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PayrollRoutingModule
  ],
  providers: [
    PayrollService
  ]
})
export class PayrollModule { }

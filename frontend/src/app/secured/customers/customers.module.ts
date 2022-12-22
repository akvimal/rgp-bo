import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { CustomerFormComponent } from "./components/customer-form.component";
import { CustomersComponent } from "./components/customers.component";
import { DialogModule } from 'primeng/dialog';

const routes: Routes = [
  { path: '', component: CustomersComponent, canActivate:[AuthGuard]},
  { path: 'new', component: CustomerFormComponent, canActivate:[AuthGuard]},
  { path: 'edit/:id', component: CustomerFormComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
      CustomerFormComponent,
      CustomersComponent
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        DialogModule,
        RouterModule.forChild(routes),
        SharedModule
    ],
    exports: [RouterModule]
  })
export class CustomersModule{}
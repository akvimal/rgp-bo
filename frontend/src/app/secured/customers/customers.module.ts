import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { CustomerFormComponent } from "./components/customer-form.component";
import { CustomersComponent } from "./components/customers.component";
import { DialogModule } from 'primeng/dialog';
import { TableModule } from "primeng/table";
import { CustomerOrdersComponent } from "./components/customer-orders.component";
import { CustomerDocumentsComponent } from "./components/customer-documents.component";
import { TabViewModule } from "primeng/tabview";
import { CustomerViewComponent } from "./components/customer-view.component";
import { DocumentsModule } from "src/app/shared/documents/documents.module";

const routes: Routes = [
  { path: 'list', component: CustomersComponent, canActivate:[AuthGuard]},
  { path: 'new', component: CustomerFormComponent, canActivate:[AuthGuard]},
  { path: 'edit/:id', component: CustomerFormComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
      CustomerFormComponent,
      CustomersComponent,
      CustomerOrdersComponent,
      CustomerDocumentsComponent,
      CustomerViewComponent
    ],
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        ReactiveFormsModule,
        DialogModule,
        TableModule,
        TabViewModule,
        SharedModule,
        DocumentsModule
    ],
    exports: [RouterModule,CustomerOrdersComponent,CustomerDocumentsComponent,CustomerViewComponent]
  })
export class CustomersModule{}
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { AutoCompleteModule } from 'primeng/autocomplete';
import { CalendarModule } from 'primeng/calendar';
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { ReturnCustomerSelectComponent } from "./components/auto-complete/returncustomer-select.component";
import { DialogModule } from 'primeng/dialog';
import { TabViewModule } from 'primeng/tabview';
import {InputNumberModule} from 'primeng/inputnumber';
import { TableModule } from "primeng/table";
import { SaleReturnsComponent } from "./components/salereturns.component";
import { ReturnItemSelectComponent } from "./components/auto-complete/returnitem-select.component";

const routes: Routes = [
  {path: '', component: SaleReturnsComponent, canActivate:[AuthGuard]},
];

@NgModule({
    declarations: [
      SaleReturnsComponent,
      ReturnCustomerSelectComponent,
      ReturnItemSelectComponent
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        AutoCompleteModule,
        CalendarModule,
        DialogModule,
        TabViewModule,
        InputNumberModule,
        TableModule,
        RouterModule.forChild(routes),
        SharedModule
    ],
    exports: [RouterModule]
  })
export class SaleReturnsModule{}
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { AutoCompleteModule } from 'primeng/autocomplete';
import { CalendarModule } from 'primeng/calendar';
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { SaleFormComponent } from "./components/sale-form.component";
import { SaleFormItemsComponent } from "./components/sale-form-items.component";
import { SaleViewComponent } from "./components/sale-view.component";
import { SalesListComponent } from "./components/sales-list.component";
import { SalesComponent } from "./components/sales.component";
import { StockSelectComponent } from "../../shared/components/stock-select.component";
import { CustomerSelectComponent } from "../../shared/components/customer-select.component";
import { DialogModule } from 'primeng/dialog';
import { TabViewModule } from 'primeng/tabview';
import {InputNumberModule} from 'primeng/inputnumber';
import { SalesItemListComponent } from "./components/sales-item-list.component";
import { TableModule } from "primeng/table";
import { SaleDashboardComponent } from "./components/sale-dashboard.component";
import { SaleHeaderComponent } from "./components/sale-header.component";
import { SaleReminderComponent } from "./components/sale-reminder.component";
import { SaleReturnsComponent } from "./components/sale-returns.component";
import { SaleReturnFormComponent } from "./components/sale-return-form.component";
import { SaleReturnAdjustFormComponent } from "./components/sale-return-adjust-form.component";
import { SalePosComponent } from "./components/sale-pos.component";

const routes: Routes = [
  {path: '', redirectTo: 'pos'},
  {path: 'list', component: SalesListComponent, canActivate:[AuthGuard]},
  {path: 'returns', component: SaleReturnsComponent, canActivate:[AuthGuard]},
  {path: 'pos', component: SalePosComponent, children: [
    {path: '', redirectTo: 'new'},
    {path: 'new', component: SaleFormComponent},
    {path: 'edit/:id', component: SaleFormComponent},
    {path: 'view/:id', component: SaleViewComponent}
  ], canActivate:[AuthGuard]},
  {path: 'reminders', component: SaleReminderComponent, canActivate:[AuthGuard]},
  
];

@NgModule({
    declarations: [
      SalesComponent,
      SalePosComponent,
      SaleHeaderComponent,
      SaleReminderComponent,
      SaleDashboardComponent,
      SalesListComponent,
      SaleReturnsComponent,
      SaleReturnFormComponent,
      SaleReturnAdjustFormComponent,
      SalesItemListComponent,
      SaleViewComponent,
      SaleFormComponent,
      SaleFormItemsComponent,
      StockSelectComponent,
      CustomerSelectComponent
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
export class SalesModule{}
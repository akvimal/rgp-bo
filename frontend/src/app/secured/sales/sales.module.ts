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
import { StockSelectComponent } from "./components/auto-complete/stock-select.component";
import { CustomerSelectComponent } from "./components/auto-complete/customer-select.component";
import {DialogModule} from 'primeng/dialog';
import {TabViewModule} from 'primeng/tabview';
import { SalesItemListComponent } from "./components/sales-item-list.component";

const routes: Routes = [
  {path: '', redirectTo: 'list'},
  {path: 'list', component: SalesListComponent, canActivate:[AuthGuard]},
  {path: 'new', component: SaleFormComponent, canActivate:[AuthGuard]},
  {path: 'view/:id', component: SaleViewComponent, canActivate:[AuthGuard]},
  {path: 'edit/:id', component: SaleFormComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
      SalesComponent,
      SalesListComponent,
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
        RouterModule.forChild(routes),
        SharedModule
    ],
    exports: [RouterModule]
  })
export class SalesModule{}
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { AutoCompleteModule } from 'primeng/autocomplete';
import {DialogModule} from 'primeng/dialog';
import {TableModule} from 'primeng/table';
import {ToastModule} from 'primeng/toast';
import {CalendarModule} from 'primeng/calendar';
import {SliderModule} from 'primeng/slider';
import {MultiSelectModule} from 'primeng/multiselect';
import {ContextMenuModule} from 'primeng/contextmenu';
import {ButtonModule} from 'primeng/button';
import {DropdownModule} from 'primeng/dropdown';
import { TabViewModule } from 'primeng/tabview';
import {ProgressBarModule} from 'primeng/progressbar';
import {InputTextModule} from 'primeng/inputtext';
import { StoreComponent } from "./store.component";
import { CashComponent } from "./cash/components/cash.component";
import { StockComponent } from "./stock/components/stock.component";
import { StockListComponent } from "./stock/components/stock-list.component";
import { StockAdjustComponent } from "./stock/components/stock-adjust.component";
import { StockDemandComponent } from "./stock/components/stock-demand.component";
import { CreditComponent } from "./credit/components/credit.component";
import { StockAuditComponent } from "./stock/components/stock-audit.component";

const routes: Routes = [
  { path: '', component: StoreComponent, canActivate:[AuthGuard], children: [
    { path: '', redirectTo: 'stock' },
    { path: 'stock', component: StockComponent, children: [
      { path: '', redirectTo: 'list' },
      { path: 'list', component: StockListComponent },
      { path: 'audit', component: StockAuditComponent },
      { path: 'adjust', component: StockAdjustComponent },
      { path: 'demand', component: StockDemandComponent }
    ]},
    { path: 'cash', component: CashComponent},
    { path: 'credit', component: CreditComponent}
  ]}
];

@NgModule({
    declarations: [
      StoreComponent,
      CashComponent,
      StockComponent,
      CreditComponent,
      StockListComponent,
      StockAuditComponent,
      StockAdjustComponent,
      StockDemandComponent
    ],
    imports: [
        FormsModule,  
        CommonModule,
        ReactiveFormsModule,
        AutoCompleteModule,
        CalendarModule,
        DialogModule,
        TableModule,
        ToastModule,
        TabViewModule,
        SliderModule,
        MultiSelectModule,
        ContextMenuModule,
        ButtonModule,
        DropdownModule,
        ProgressBarModule,
        InputTextModule,
        RouterModule.forChild(routes),
        SharedModule
    ],
    exports: [RouterModule]
  })
export class StoreModule{}
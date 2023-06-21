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
import { StockListComponent } from "./components/stock-list.component";
import { StockHeaderComponent } from "./components/stock-header.component";
import { StockComponent } from "./components/stock.component";
import { StockAdjustComponent } from "./components/stock-adjust.component";
import { StockAuditComponent } from "./components/stock-audit.component";
import { StockDemandComponent } from "./components/stock-demand.component";

const routes: Routes = [
  { path: '', redirectTo: 'list'},
  { path: 'list', component: StockListComponent, canActivate:[AuthGuard]},
  { path: 'adjust', component: StockAdjustComponent, canActivate:[AuthGuard]},
  { path: 'demand', component: StockDemandComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
      StockComponent,
      StockListComponent,
      StockAdjustComponent,
      StockAuditComponent,
      StockDemandComponent,
      StockHeaderComponent
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
export class StockModule{}
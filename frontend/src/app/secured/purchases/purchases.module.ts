import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { InvoiceFormComponent } from "./invoices/components/invoice-form.component";
import { InvoiceItemsComponent } from "./invoices/components/invoice-items.component";
import { InvoicePaymentComponent } from "./invoices/components/invoice-payment.component";
import { InvoicesComponent } from "./invoices/components/invoices.component";
import { StockComponent } from "./stock/components/stock.component";
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
import {ProgressBarModule} from 'primeng/progressbar';
import {InputTextModule} from 'primeng/inputtext';

const routes: Routes = [
  { path: '', redirectTo: 'list'},
    {path: 'list', component: InvoicesComponent, canActivate:[AuthGuard]},
    {path: 'new', component: InvoiceFormComponent, canActivate:[AuthGuard]},
    {path: 'edit/:id', component: InvoiceFormComponent, canActivate:[AuthGuard]},
    {path: 'items/:id', component: InvoiceItemsComponent, canActivate:[AuthGuard]},
    {path: 'stock', component: StockComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
      InvoicesComponent,
      InvoiceFormComponent,
      InvoiceItemsComponent,
      InvoicePaymentComponent,
      StockComponent
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
export class PurchasesModule{}
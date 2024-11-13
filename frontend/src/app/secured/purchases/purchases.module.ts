import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { InvoiceFormComponent } from "./invoices/components/invoice-form.component";
import { InvoiceItemsComponent } from "./invoices/components/invoice-items.component";
import { InvoicePaymentComponent } from "./invoices/components/invoice-payment.component";
import { InvoiceListComponent } from "./invoices/components/invoice-list.component";
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
import { InvoiceItemFormComponent } from "./invoices/components/invoice-item-form.component";
import { PurchaseRequestComponent } from "./requests/components/purchase-request.component";
import { PurchaseHeaderComponent } from "./purchase-header.component";
import { PurchasesComponent } from "./invoices/components/purchases.component";
import { TabViewModule } from "primeng/tabview";
import { PurchaseOrderComponent } from "./requests/components/purchase-order.component";
import { PurchaseOrderViewComponent } from "./requests/components/purchase-order-view.component";
import { InvoicesComponent } from "./invoices/components/invoices.component";
import { PurchaseHomeComponent } from "./purchases-home.component";

const routes: Routes = [
  { path: '', component: PurchaseHomeComponent, canActivate:[AuthGuard],
    children: [
      { path: '', redirectTo: 'invoices'},
      { path: 'intents', component: PurchaseRequestComponent },
      { path: 'orders', component: PurchaseOrderComponent,
          children: [
            { path: ':id', component: PurchaseOrderViewComponent }
          ]
      },
      { path: 'invoices', 
          children: [
            { path: '', redirectTo: 'list'},
            { path: 'list', component: InvoiceListComponent},
            { path: 'new', component: InvoiceFormComponent},
            { path: 'edit/:id', component: InvoiceFormComponent},
            { path: 'items/:id', component: InvoiceItemsComponent}
          ]
      },
      {
        path: 'vendors',
        loadChildren: () => import('./vendors/vendors.module').then(m => m.VendorsModule)
      }
  ]}
];

@NgModule({
    declarations: [
      PurchaseHomeComponent,
      PurchasesComponent,
      PurchaseHeaderComponent,
      PurchaseRequestComponent,
      PurchaseOrderComponent,
      PurchaseOrderViewComponent,
      InvoicesComponent,
      InvoiceListComponent,
      InvoiceFormComponent,
      InvoiceItemsComponent,
      InvoiceItemFormComponent,
      InvoicePaymentComponent
    ],
    imports: [
        FormsModule,  
        CommonModule,
        ReactiveFormsModule,
        AutoCompleteModule,
        CalendarModule,
        DialogModule,
        TabViewModule,
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
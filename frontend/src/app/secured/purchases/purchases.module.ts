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
import { PayablesComponent } from "./invoices/components/payables.component";
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
import { PurchaseHeaderComponent } from "./purchase-header.component";
import { TabViewModule } from "primeng/tabview";
import { PurchaseOrderComponent } from "./requests/components/purchase-order.component";
import { PurchaseOrderViewComponent } from "./requests/components/purchase-order-view.component";
import { PurchaseRequestComponent } from "./requests/components/purchase-request.component";
import { PurchaseSuggestionComponent } from "./requests/components/purchase-suggestion.component";
import { PurchaseOrdersHomeComponent } from "./requests/components/purchase-orders-home.component";
import { GstReconciliationComponent } from "./gst/components/gst-reconciliation.component";
import { PurchaseHomeComponent } from "./purchases-home.component";
import { PurchaseSettingsComponent } from "./purchase-settings.component";

const routes: Routes = [
  { path: '', component: PurchaseHomeComponent, canActivate:[AuthGuard],
    children: [
      { path: '', redirectTo: 'invoices'},
      { path: 'orders', component: PurchaseOrdersHomeComponent, data: { tab: 'reorder' },
          children: [
            { path: ':id', component: PurchaseOrderViewComponent }
          ]
      },
      { path: 'requests', component: PurchaseOrdersHomeComponent, data: { tab: 'requests' } },
      { path: 'suggestions', component: PurchaseOrdersHomeComponent, data: { tab: 'reorder' } },
      { path: 'payables', component: PayablesComponent },
      { path: 'gst', component: GstReconciliationComponent },
      { path: 'settings', component: PurchaseSettingsComponent },
      { path: 'invoices', 
          children: [
            { path: '', redirectTo: 'list'},
            { path: 'list', component: InvoiceListComponent},
            { path: 'outstanding', component: InvoiceListComponent},
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
      PurchaseHeaderComponent,
      PurchaseOrdersHomeComponent,
      PurchaseOrderComponent,
      PurchaseOrderViewComponent,
      PurchaseRequestComponent,
      PurchaseSuggestionComponent,
      InvoiceListComponent,
      PayablesComponent,
      GstReconciliationComponent,
      InvoiceFormComponent,
      InvoiceItemsComponent,
      InvoiceItemFormComponent,
      InvoicePaymentComponent,
      PurchaseSettingsComponent
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

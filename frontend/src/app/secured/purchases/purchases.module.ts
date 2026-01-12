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
import { InvoiceStatusBadgesComponent } from "./invoices/components/invoice-status-badges.component";
import { InvoiceDocumentUploadComponent } from "./invoices/components/invoice-document-upload.component";
import { InvoiceTaxCreditComponent } from "./invoices/components/invoice-tax-credit.component";
import { InvoiceLifecycleSummaryComponent } from "./invoices/components/invoice-lifecycle-summary.component";
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
import { PurchasesComponent } from "./invoices/components/purchases.component";
import { TabViewModule } from "primeng/tabview";
import { PurchaseOrderComponent } from "./requests/components/purchase-order.component";
import { PurchaseOrderViewComponent } from "./requests/components/purchase-order-view.component";
import { PurchaseOrderFromIntentsComponent } from "./requests/components/purchase-order-from-intents.component";
import { PurchaseOrderFormEnhancedComponent } from "./requests/components/purchase-order-form-enhanced.component";
import { SmartPOSuggestionsComponent } from "./requests/components/smart-po-suggestions.component";
import { InvoicesComponent } from "./invoices/components/invoices.component";
import { PurchaseHomeComponent } from "./purchases-home.component";

const routes: Routes = [
  { path: '', component: PurchaseHomeComponent, canActivate:[AuthGuard],
    children: [
      { path: '', redirectTo: 'invoices'},
      { path: 'orders/suggestions', component: SmartPOSuggestionsComponent },
      { path: 'orders/from-intents', component: PurchaseOrderFromIntentsComponent },
      { path: 'orders/new', component: PurchaseOrderFormEnhancedComponent },
      { path: 'orders/:id', component: PurchaseOrderViewComponent },
      { path: 'orders', component: PurchaseOrderComponent },
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
      PurchaseOrderComponent,
      PurchaseOrderViewComponent,
      PurchaseOrderFromIntentsComponent,
      PurchaseOrderFormEnhancedComponent,
      SmartPOSuggestionsComponent,
      InvoicesComponent,
      InvoiceListComponent,
      InvoiceFormComponent,
      InvoiceItemsComponent,
      InvoiceItemFormComponent,
      InvoicePaymentComponent,
      InvoiceStatusBadgesComponent,
      InvoiceDocumentUploadComponent,
      InvoiceTaxCreditComponent,
      InvoiceLifecycleSummaryComponent
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